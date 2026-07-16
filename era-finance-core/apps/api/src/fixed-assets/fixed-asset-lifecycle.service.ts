import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetLifecycleEventType,
  FixedAssetStatus,
  LedgerType,
  Prisma,
  type PostingRole,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoney2 } from "./decimal-round";
import {
  AcquireFixedAssetDto,
  AcquireWithCreateFixedAssetDto,
  FixedAssetCreditSource,
} from "./dto/acquire-fixed-asset.dto";
import { ModernizeFixedAssetDto } from "./dto/modernize-fixed-asset.dto";
import {
  FixedAssetRevaluationDirection,
  RevalueFixedAssetDto,
} from "./dto/revalue-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";
import {
  DEFAULT_TAX_DEPRECIATION_GROUP,
  resolveTaxDepreciationRateFraction,
} from "./tax-depreciation-catalog.util";

const Decimal = Prisma.Decimal;

@Injectable()
export class FixedAssetLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  listLifecycleEvents(organizationId: string, assetId: string) {
    return this.prisma.fixedAssetLifecycleEvent.findMany({
      where: { organizationId, fixedAssetId: assetId },
      orderBy: [{ createdAt: "desc" }],
      include: { transaction: { select: { id: true, reference: true, date: true } } },
    });
  }

  async acquire(organizationId: string, assetId: string, dto: AcquireFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.acquireInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async acquireWithCreate(organizationId: string, dto: AcquireWithCreateFixedAssetDto) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          inventoryNumber: dto.inventoryNumber.trim(),
          purchaseDate: new Date(dto.purchaseDate),
          purchasePrice: new Decimal(dto.purchasePrice),
          usefulLifeMonths: dto.usefulLifeMonths,
          salvageValue: new Decimal(dto.salvageValue ?? 0),
        },
      });
      return this.acquireInTransaction(tx, organizationId, asset.id, dto);
    });
  }

  async modernize(organizationId: string, assetId: string, dto: ModernizeFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.modernizeInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async revalue(organizationId: string, assetId: string, dto: RevalueFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.revalueInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async dispose(organizationId: string, assetId: string, dto: DisposeFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.disposeInTransaction(tx, organizationId, assetId, dto),
    );
  }

  private async acquireInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: AcquireFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const existing = await tx.fixedAssetLifecycleEvent.findFirst({
      where: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetLifecycleEventType.ACQUISITION,
      },
    });
    if (existing) {
      throw new ConflictException("Asset is already capitalized (ACQUISITION exists)");
    }

    const gross = new Decimal(asset.purchasePrice).add(asset.modernizationCost);
    const amount = dto.amount != null ? roundMoney2(new Decimal(dto.amount)) : roundMoney2(gross);
    if (amount.lte(0)) {
      throw new BadRequestException("Capitalization amount must be positive");
    }

    const date = dto.date ? new Date(dto.date) : asset.purchaseDate;
    const creditRole = this.creditRoleForSource(dto.creditSource);
    this.assertCreditSource(dto.creditSource, dto.counterpartyId);

    const [fixedAssetCostCode, creditCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, creditRole, tx),
    ]);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-ACQ-${asset.inventoryNumber}`,
      description: `Fixed asset acquisition: ${asset.name}`,
      isFinal: true,
      counterpartyId:
        dto.creditSource === FixedAssetCreditSource.SUPPLIER ? dto.counterpartyId : null,
      lines: [
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: creditCode, debit: "0", credit: amount.toString() },
      ],
    });

    const fixedAssetAccountId =
      asset.fixedAssetAccountId ??
      (await this.resolveNasAccountId(tx, organizationId, "FIXED_ASSET_COST"));

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: { fixedAssetAccountId },
    });

    await this.ensureTaxProfileOnCapitalization(tx, organizationId, assetId, amount);

    const event = await tx.fixedAssetLifecycleEvent.create({
      data: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetLifecycleEventType.ACQUISITION,
        amount,
        note: dto.note?.trim() || null,
        transactionId,
        payloadJson: {
          creditSource: dto.creditSource,
          counterpartyId: dto.counterpartyId ?? null,
        },
      },
    });

    return { asset: updated, event, transactionId };
  }

  private async modernizeInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: ModernizeFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount = roundMoney2(new Decimal(dto.amount));
    const date = dto.date ? new Date(dto.date) : new Date();
    const creditRole = this.creditRoleForSource(dto.creditSource);
    this.assertCreditSource(dto.creditSource, dto.counterpartyId);

    const [fixedAssetCostCode, creditCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, creditRole, tx),
    ]);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-MOD-${asset.inventoryNumber}`,
      description: `Fixed asset modernization: ${asset.name}`,
      isFinal: true,
      counterpartyId:
        dto.creditSource === FixedAssetCreditSource.SUPPLIER ? dto.counterpartyId : null,
      lines: [
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: creditCode, debit: "0", credit: amount.toString() },
      ],
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        modernizationCost: { increment: amount },
        fixedAssetAccountId:
          asset.fixedAssetAccountId ??
          (await this.resolveNasAccountId(tx, organizationId, "FIXED_ASSET_COST")),
      },
    });

    await this.adjustTaxNbv(tx, organizationId, assetId, amount, "ADD");

    const event = await tx.fixedAssetLifecycleEvent.create({
      data: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetLifecycleEventType.MODERNIZATION,
        amount,
        note: dto.note?.trim() || null,
        transactionId,
        payloadJson: {
          creditSource: dto.creditSource,
          counterpartyId: dto.counterpartyId ?? null,
        },
      },
    });

    return { asset: updated, event, transactionId };
  }

  private async revalueInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: RevalueFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount = roundMoney2(new Decimal(dto.amount));
    const date = dto.date ? new Date(dto.date) : new Date();
    const remaining = this.remainingPortion(asset);

    const [fixedAssetCostCode, revaluationReserveCode, disposalLossCode] =
      await Promise.all([
        this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
        this.posting.resolveAccountCode(organizationId, "REVALUATION_RESERVE", tx),
        this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
      ]);

    const lines: { accountCode: string; debit: string; credit: string }[] = [];

    if (dto.direction === FixedAssetRevaluationDirection.UP) {
      lines.push(
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: revaluationReserveCode, debit: "0", credit: amount.toString() },
      );
    } else {
      const reserve = roundMoney2(new Decimal(asset.revaluationReserve));
      const fromReserve = Decimal.min(amount, reserve);
      const loss = roundMoney2(amount.sub(fromReserve));

      if (fromReserve.gt(0)) {
        lines.push(
          { accountCode: revaluationReserveCode, debit: fromReserve.toString(), credit: "0" },
          { accountCode: fixedAssetCostCode, debit: "0", credit: fromReserve.toString() },
        );
      }
      if (loss.gt(0)) {
        lines.push(
          { accountCode: disposalLossCode, debit: loss.toString(), credit: "0" },
          { accountCode: fixedAssetCostCode, debit: "0", credit: loss.toString() },
        );
      }
      if (lines.length === 0) {
        throw new BadRequestException("Revaluation down amount must be positive");
      }
    }

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-REV-${asset.inventoryNumber}`,
      description: `Fixed asset revaluation ${dto.direction}: ${asset.name}`,
      isFinal: true,
      lines,
    });

    const grossBefore = this.grossCarrying(asset);
    let data: Prisma.FixedAssetUpdateInput;
    if (dto.direction === FixedAssetRevaluationDirection.UP) {
      data = {
        purchasePrice: { increment: amount },
        revaluationReserve: { increment: amount },
      };
      await this.adjustTaxNbvProportional(tx, organizationId, assetId, grossBefore, grossBefore.add(amount));
    } else {
      const reserve = roundMoney2(new Decimal(asset.revaluationReserve));
      const fromReserve = Decimal.min(amount, reserve);
      const loss = roundMoney2(amount.sub(fromReserve));
      data = {
        purchasePrice: { decrement: amount },
        revaluationReserve: { decrement: fromReserve },
      };
      if (loss.gt(0)) {
        // Loss portion already expensed; carrying reduced via purchasePrice decrement.
      }
      await this.adjustTaxNbvProportional(
        tx,
        organizationId,
        assetId,
        grossBefore,
        grossBefore.sub(amount),
      );
    }

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data,
    });

    const event = await tx.fixedAssetLifecycleEvent.create({
      data: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetLifecycleEventType.REVALUATION,
        amount,
        note: dto.note?.trim() || null,
        transactionId,
        payloadJson: {
          direction: dto.direction,
          remainingPortion: remaining.toString(),
        },
      },
    });

    return { asset: updated, event, transactionId };
  }

  private async disposeInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: DisposeFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const portion = new Decimal(dto.portion ?? 1);
    if (portion.lte(0) || portion.gt(1)) {
      throw new BadRequestException("portion must be in (0, 1]");
    }

    const disposed = new Decimal(asset.disposedPortion);
    const remaining = this.remainingPortion(asset);
    if (portion.gt(remaining)) {
      throw new BadRequestException(
        `Cannot dispose ${portion.toString()}; only ${remaining.toString()} remains`,
      );
    }

    const grossTotal = this.grossCarrying(asset);
    const gross = roundMoney2(grossTotal.mul(portion));
    const accDep = roundMoney2(new Decimal(asset.bookedDepreciation).mul(portion));
    const nbv = roundMoney2(gross.sub(accDep));
    const proceeds =
      dto.proceeds != null ? roundMoney2(new Decimal(dto.proceeds)) : new Decimal(0);

    const [
      accumulatedDepreciationCode,
      fixedAssetCostCode,
      disposalGainCode,
      disposalLossCode,
      bankCode,
    ] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "ACCUMULATED_DEPRECIATION", tx),
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_GAIN", tx),
      this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
      this.posting.resolveAccountCode(organizationId, "MAIN_BANK", tx),
    ]);

    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    if (accDep.gt(0)) {
      lines.push({
        accountCode: accumulatedDepreciationCode,
        debit: accDep.toString(),
        credit: "0",
      });
    }
    if (proceeds.gt(0)) {
      lines.push({
        accountCode: bankCode,
        debit: proceeds.toString(),
        credit: "0",
      });
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
      accountCode: fixedAssetCostCode,
      debit: "0",
      credit: gross.toString(),
    });

    const date = dto.date ? new Date(dto.date) : new Date();
    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-DISP-${asset.inventoryNumber}`,
      description: `Fixed asset disposal (${portion.mul(100).toFixed(2)}%): ${asset.name}`,
      isFinal: true,
      lines,
    });

    const newDisposed = roundMoney2(disposed.add(portion));
    const fullyDisposed = newDisposed.gte(1) || newDisposed.gte(remaining);

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        disposedPortion: newDisposed,
        bookedDepreciation: { decrement: accDep },
        purchasePrice: { decrement: roundMoney2(new Decimal(asset.purchasePrice).mul(portion)) },
        modernizationCost: {
          decrement: roundMoney2(new Decimal(asset.modernizationCost).mul(portion)),
        },
        status: fullyDisposed ? FixedAssetStatus.DISPOSED : asset.status,
        disposalDate: fullyDisposed ? date : asset.disposalDate,
      },
    });

    await this.adjustTaxNbv(tx, organizationId, assetId, gross, "SUBTRACT");

    const event = await tx.fixedAssetLifecycleEvent.create({
      data: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetLifecycleEventType.DISPOSAL,
        amount: gross,
        portion,
        note: dto.note?.trim() || null,
        transactionId,
        payloadJson: {
          nbv: nbv.toString(),
          proceeds: proceeds.toString(),
          accDepPortion: accDep.toString(),
        },
      },
    });

    return { asset: updated, event, transactionId, nbv: nbv.toString(), gainLoss: net.toString() };
  }

  private async getActiveAsset(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
  ) {
    const asset = await tx.fixedAsset.findFirst({
      where: { id: assetId, organizationId },
      include: { taxProfile: true },
    });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    if (asset.status === FixedAssetStatus.DISPOSED) {
      throw new BadRequestException("Asset is already disposed");
    }
    return asset;
  }

  private grossCarrying(asset: {
    purchasePrice: Prisma.Decimal;
    modernizationCost: Prisma.Decimal;
  }): Prisma.Decimal {
    return new Decimal(asset.purchasePrice).add(asset.modernizationCost);
  }

  private remainingPortion(asset: { disposedPortion: Prisma.Decimal }): Prisma.Decimal {
    const rem = new Decimal(1).sub(asset.disposedPortion);
    return rem.lt(0) ? new Decimal(0) : rem;
  }

  private creditRoleForSource(source: FixedAssetCreditSource): PostingRole {
    return source === FixedAssetCreditSource.SUPPLIER ? "SUPPLIER_PAYABLE" : "MAIN_BANK";
  }

  private assertCreditSource(source: FixedAssetCreditSource, counterpartyId?: string): void {
    if (source === FixedAssetCreditSource.SUPPLIER && !counterpartyId) {
      throw new BadRequestException("counterpartyId is required when creditSource is SUPPLIER");
    }
  }

  private async resolveNasAccountId(
    tx: Prisma.TransactionClient,
    organizationId: string,
    role: PostingRole,
  ): Promise<string> {
    const code = await this.posting.resolveAccountCode(organizationId, role, tx);
    const acc = await tx.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!acc) {
      throw new NotFoundException(`NAS account ${code} not found for role ${role}`);
    }
    return acc.id;
  }

  private async ensureTaxProfileOnCapitalization(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const profile = await tx.fixedAssetTaxProfile.findUnique({
      where: { fixedAssetId: assetId },
    });
    if (profile) return;
    const asset = await tx.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    const rateFraction = await resolveTaxDepreciationRateFraction(DEFAULT_TAX_DEPRECIATION_GROUP);
    await tx.fixedAssetTaxProfile.create({
      data: {
        organizationId,
        fixedAssetId: assetId,
        taxGroupCode: DEFAULT_TAX_DEPRECIATION_GROUP,
        taxRatePercent: new Decimal(rateFraction),
        taxNbv: amount,
        taxAccumulated: new Decimal(0),
      },
    });
  }

  private async adjustTaxNbv(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    delta: Prisma.Decimal,
    mode: "ADD" | "SUBTRACT",
  ): Promise<void> {
    const profile = await tx.fixedAssetTaxProfile.findUnique({
      where: { fixedAssetId: assetId },
    });
    if (!profile) return;
    const current = new Decimal(profile.taxNbv);
    const next =
      mode === "ADD"
        ? roundMoney2(current.add(delta))
        : roundMoney2(Decimal.max(new Decimal(0), current.sub(delta)));
    await tx.fixedAssetTaxProfile.update({
      where: { id: profile.id },
      data: { taxNbv: next },
    });
  }

  /** Proportional tax NBV adjustment on revaluation (book gross change ratio). */
  private async adjustTaxNbvProportional(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    grossBefore: Prisma.Decimal,
    grossAfter: Prisma.Decimal,
  ): Promise<void> {
    const profile = await tx.fixedAssetTaxProfile.findUnique({
      where: { fixedAssetId: assetId },
    });
    if (!profile || grossBefore.lte(0)) return;
    const ratio = grossAfter.div(grossBefore);
    const next = roundMoney2(new Decimal(profile.taxNbv).mul(ratio));
    await tx.fixedAssetTaxProfile.update({
      where: { id: profile.id },
      data: { taxNbv: Decimal.max(new Decimal(0), next) },
    });
  }
}
