import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
  Prisma,
  type PostingRole,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { roundMoney2 } from "../fixed-assets/decimal-round";
import { FixedAssetCreditSource } from "../fixed-assets/dto/acquire-fixed-asset.dto";
import { monthRangeUtc } from "../reporting/reporting-period.util";
import {
  AcquireIntangibleAssetDto,
  DisposeIntangibleAssetDto,
} from "./dto/intangible-lifecycle.dto";

const Decimal = Prisma.Decimal;

@Injectable()
export class IntangibleAmortizationService {
  constructor(
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  async applyForClosedMonth(
    tx: Prisma.TransactionClient,
    organizationId: string,
    year: number,
    month: number,
  ): Promise<{ transactionId: string | null; totalAmount: string; assetsCount: number }> {
    const { end } = monthRangeUtc(year, month);
    const monthEnd = end;

    const assets = await tx.intangibleAsset.findMany({
      where: {
        organizationId,
        status: FixedAssetStatus.ACTIVE,
        depreciationMethod: FixedAssetDepreciationMethod.STRAIGHT_LINE,
      },
    });

    type Row = { assetId: string; amount: Prisma.Decimal };
    const rows: Row[] = [];

    for (const a of assets) {
      const exists = await tx.intangibleAmortizationMonth.findUnique({
        where: {
          intangibleAssetId_year_month: {
            intangibleAssetId: a.id,
            year,
            month,
          },
        },
      });
      if (exists) continue;
      if (a.purchaseDate.getTime() > monthEnd.getTime()) continue;

      const maxAmort = new Decimal(a.purchasePrice).sub(a.salvageValue);
      if (maxAmort.lte(0)) continue;

      const booked = new Decimal(a.bookedAmortization);
      const remaining = maxAmort.sub(booked);
      if (remaining.lte(0)) continue;

      const monthly = roundMoney2(maxAmort.div(a.usefulLifeMonths));
      let amount = monthly.gt(remaining) ? roundMoney2(remaining) : monthly;
      if (amount.lte(0)) continue;

      rows.push({ assetId: a.id, amount });
    }

    if (rows.length === 0) {
      return { transactionId: null, totalAmount: "0", assetsCount: 0 };
    }

    const [expenseCode, accumulatedCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "DEPRECIATION_EXPENSE", tx),
      this.posting.resolveAccountCode(
        organizationId,
        "ACCUMULATED_AMORTIZATION_INTANGIBLE",
        tx,
      ),
    ]);

    let total = new Decimal(0);
    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    for (const r of rows) {
      total = total.add(r.amount);
      lines.push({
        accountCode: expenseCode,
        debit: r.amount.toString(),
        credit: "0",
      });
    }
    lines.push({
      accountCode: accumulatedCode,
      debit: "0",
      credit: roundMoney2(total).toString(),
    });

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date: monthEnd,
      reference: `IA-AMORT-${year}-${String(month).padStart(2, "0")}`,
      description: `Intangible asset amortization ${month}/${year}`,
      isFinal: true,
      lines,
    });

    for (const r of rows) {
      await tx.intangibleAmortizationMonth.create({
        data: {
          organizationId,
          intangibleAssetId: r.assetId,
          year,
          month,
          amount: r.amount,
          transactionId,
        },
      });
      await tx.intangibleAsset.update({
        where: { id: r.assetId },
        data: { bookedAmortization: { increment: r.amount } },
      });
    }

    return {
      transactionId,
      totalAmount: roundMoney2(total).toString(),
      assetsCount: rows.length,
    };
  }

  async acquireInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: AcquireIntangibleAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount =
      dto.amount != null
        ? roundMoney2(new Decimal(dto.amount))
        : roundMoney2(new Decimal(asset.purchasePrice));
    const date = dto.date ? new Date(dto.date) : asset.purchaseDate;
    const creditRole = this.creditRoleForSource(dto.creditSource);
    this.assertCreditSource(dto.creditSource, dto.counterpartyId);

    const [intangibleCode, creditCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "INTANGIBLE_ASSET", tx),
      this.posting.resolveAccountCode(organizationId, creditRole, tx),
    ]);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `IA-ACQ-${asset.inventoryNumber}`,
      description: `Intangible asset acquisition: ${asset.name}`,
      isFinal: true,
      counterpartyId:
        dto.creditSource === FixedAssetCreditSource.SUPPLIER ? dto.counterpartyId : null,
      lines: [
        { accountCode: intangibleCode, debit: amount.toString(), credit: "0" },
        { accountCode: creditCode, debit: "0", credit: amount.toString() },
      ],
    });

    return { asset, transactionId, amount: amount.toString() };
  }

  async disposeInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: DisposeIntangibleAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const gross = roundMoney2(new Decimal(asset.purchasePrice));
    const accAmort = roundMoney2(new Decimal(asset.bookedAmortization));
    const nbv = roundMoney2(gross.sub(accAmort));
    const proceeds =
      dto.proceeds != null ? roundMoney2(new Decimal(dto.proceeds)) : new Decimal(0);

    const [
      accumulatedCode,
      intangibleCode,
      disposalGainCode,
      disposalLossCode,
      bankCode,
    ] = await Promise.all([
      this.posting.resolveAccountCode(
        organizationId,
        "ACCUMULATED_AMORTIZATION_INTANGIBLE",
        tx,
      ),
      this.posting.resolveAccountCode(organizationId, "INTANGIBLE_ASSET", tx),
      this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_GAIN", tx),
      this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
      this.posting.resolveAccountCode(organizationId, "MAIN_BANK", tx),
    ]);

    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    if (accAmort.gt(0)) {
      lines.push({
        accountCode: accumulatedCode,
        debit: accAmort.toString(),
        credit: "0",
      });
    }
    if (proceeds.gt(0)) {
      lines.push({ accountCode: bankCode, debit: proceeds.toString(), credit: "0" });
    }

    const net = proceeds.sub(nbv);
    if (net.gt(0)) {
      lines.push({
        accountCode: disposalGainCode,
        debit: "0",
        credit: roundMoney2(net).toString(),
      });
    } else if (net.lt(0)) {
      lines.push({
        accountCode: disposalLossCode,
        debit: roundMoney2(net.neg()).toString(),
        credit: "0",
      });
    }

    lines.push({
      accountCode: intangibleCode,
      debit: "0",
      credit: gross.toString(),
    });

    const date = dto.date ? new Date(dto.date) : new Date();
    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `IA-DISP-${asset.inventoryNumber}`,
      description: `Intangible asset disposal: ${asset.name}`,
      isFinal: true,
      lines,
    });

    const updated = await tx.intangibleAsset.update({
      where: { id: assetId },
      data: { status: FixedAssetStatus.DISPOSED },
    });

    return {
      asset: updated,
      transactionId,
      nbv: nbv.toString(),
      gainLoss: net.toString(),
    };
  }

  private async getActiveAsset(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
  ) {
    const asset = await tx.intangibleAsset.findFirst({
      where: { id: assetId, organizationId },
    });
    if (!asset) throw new NotFoundException("Intangible asset not found");
    if (asset.status === FixedAssetStatus.DISPOSED) {
      throw new BadRequestException("Intangible asset is already disposed");
    }
    return asset;
  }

  private creditRoleForSource(source: FixedAssetCreditSource): PostingRole {
    return source === FixedAssetCreditSource.SUPPLIER ? "SUPPLIER_PAYABLE" : "MAIN_BANK";
  }

  private assertCreditSource(source: FixedAssetCreditSource, counterpartyId?: string): void {
    if (source === FixedAssetCreditSource.SUPPLIER && !counterpartyId) {
      throw new BadRequestException("counterpartyId is required when creditSource is SUPPLIER");
    }
  }
}
