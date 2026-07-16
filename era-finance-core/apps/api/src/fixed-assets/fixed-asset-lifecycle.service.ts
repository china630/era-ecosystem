import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FixedAssetEventType,
  FixedAssetStatus,
  Prisma,
  type PostingRole,
} from "@erafinance/database";
import { AccountingService } from "../accounting/accounting.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoney2 } from "./decimal-round";
import {
  AcquireFixedAssetDto,
  FixedAssetCreditSource,
} from "./dto/acquire-fixed-asset.dto";
import { CapitalizeFixedAssetDto } from "./dto/capitalize-fixed-asset.dto";
import { CommissionFixedAssetDto } from "./dto/commission-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";
import {
  GratuitousInFixedAssetDto,
  GratuitousOutFixedAssetDto,
} from "./dto/gratuitous-fixed-asset.dto";
import {
  FixedAssetInventoryDirection,
  InventoryFixedAssetDto,
} from "./dto/inventory-fixed-asset.dto";
import {
  FixedAssetRevaluationDirection,
  RevalueFixedAssetDto,
} from "./dto/revalue-fixed-asset.dto";
import { TransferFixedAssetDto } from "./dto/transfer-fixed-asset.dto";

const Decimal = Prisma.Decimal;

@Injectable()
export class FixedAssetLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  listEvents(organizationId: string, assetId: string) {
    return this.prisma.fixedAssetEvent.findMany({
      where: { organizationId, fixedAssetId: assetId },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      include: {
        transaction: { select: { id: true, reference: true, date: true } },
      },
    });
  }

  async acquire(organizationId: string, assetId: string, dto: AcquireFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.acquireInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async commission(
    organizationId: string,
    assetId: string,
    dto: CommissionFixedAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.commissionInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async capitalize(
    organizationId: string,
    assetId: string,
    dto: CapitalizeFixedAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.capitalizeInTransaction(tx, organizationId, assetId, dto),
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

  async transfer(organizationId: string, assetId: string, dto: TransferFixedAssetDto) {
    return this.prisma.$transaction((tx) =>
      this.transferInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async gratuitousIn(
    organizationId: string,
    assetId: string,
    dto: GratuitousInFixedAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.gratuitousInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async gratuitousOut(
    organizationId: string,
    assetId: string,
    dto: GratuitousOutFixedAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.gratuitousOutInTransaction(tx, organizationId, assetId, dto),
    );
  }

  async inventory(
    organizationId: string,
    assetId: string,
    dto: InventoryFixedAssetDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.inventoryInTransaction(tx, organizationId, assetId, dto),
    );
  }

  private async acquireInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: AcquireFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const existing = await tx.fixedAssetEvent.findFirst({
      where: {
        organizationId,
        fixedAssetId: assetId,
        eventType: FixedAssetEventType.ACQUIRE,
      },
    });
    if (existing) {
      throw new ConflictException("Asset is already acquired (ACQUIRE exists)");
    }

    const amount =
      dto.amount != null
        ? roundMoney2(new Decimal(dto.amount))
        : roundMoney2(new Decimal(asset.purchasePrice));
    if (amount.lte(0)) {
      throw new BadRequestException("Acquisition amount must be positive");
    }

    const date = dto.date ? new Date(dto.date) : asset.purchaseDate;
    this.assertCreditSource(dto.creditSource, dto.counterpartyId);
    const creditRole = this.creditRoleForSource(dto.creditSource);

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
      departmentId: asset.departmentId,
      lines: [
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: creditCode, debit: "0", credit: amount.toString() },
      ],
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        counterpartyId:
          dto.creditSource === FixedAssetCreditSource.SUPPLIER
            ? dto.counterpartyId ?? asset.counterpartyId
            : asset.counterpartyId,
        purchasePrice: amount,
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.ACQUIRE,
      amount,
      eventDate: date,
      transactionId,
      note: dto.note,
    });

    return { asset: updated, event, transactionId };
  }

  private async commissionInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: CommissionFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const date = dto.date ? new Date(dto.date) : new Date();

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: { purchaseDate: date },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.COMMISSION,
      amount: new Decimal(0),
      eventDate: date,
      note: dto.note,
    });

    return { asset: updated, event, transactionId: null };
  }

  private async capitalizeInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: CapitalizeFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount = roundMoney2(new Decimal(dto.amount));
    const date = dto.date ? new Date(dto.date) : new Date();
    this.assertCreditSource(dto.creditSource, dto.counterpartyId);
    const creditRole = this.creditRoleForSource(dto.creditSource);

    const [fixedAssetCostCode, creditCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, creditRole, tx),
    ]);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-CAP-${asset.inventoryNumber}`,
      description: `Fixed asset capitalization: ${asset.name}`,
      isFinal: true,
      counterpartyId:
        dto.creditSource === FixedAssetCreditSource.SUPPLIER ? dto.counterpartyId : null,
      departmentId: asset.departmentId,
      lines: [
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: creditCode, debit: "0", credit: amount.toString() },
      ],
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: { purchasePrice: { increment: amount } },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.CAPITALIZE,
      amount,
      eventDate: date,
      transactionId,
      note: dto.note,
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

    const [fixedAssetCostCode, revaluationReserveCode, disposalLossCode] =
      await Promise.all([
        this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
        this.posting.resolveAccountCode(organizationId, "REVALUATION_RESERVE", tx),
        this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
      ]);

    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    let reserveDelta = new Decimal(0);

    if (dto.direction === FixedAssetRevaluationDirection.UP) {
      lines.push(
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: revaluationReserveCode, debit: "0", credit: amount.toString() },
      );
      reserveDelta = amount;
    } else {
      const reserve = roundMoney2(new Decimal(asset.revaluationReserve));
      const fromReserve = Decimal.min(amount, reserve);
      const loss = roundMoney2(amount.sub(fromReserve));
      reserveDelta = fromReserve.neg();

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
      departmentId: asset.departmentId,
      lines,
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        purchasePrice:
          dto.direction === FixedAssetRevaluationDirection.UP
            ? { increment: amount }
            : { decrement: amount },
        revaluationReserve: { increment: reserveDelta },
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.REVALUE,
      amount,
      eventDate: date,
      transactionId,
      note: dto.note,
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
    const gross = roundMoney2(new Decimal(asset.purchasePrice));
    const accDep = roundMoney2(new Decimal(asset.bookedDepreciation));
    const nbv = roundMoney2(gross.sub(accDep));
    const proceeds =
      dto.proceeds != null ? roundMoney2(new Decimal(dto.proceeds)) : new Decimal(0);
    const date = dto.date ? new Date(dto.date) : new Date();

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

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-DISP-${asset.inventoryNumber}`,
      description: `Fixed asset disposal: ${asset.name}`,
      isFinal: true,
      departmentId: asset.departmentId,
      lines,
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        status: FixedAssetStatus.DISPOSED,
        disposalDate: date,
        disposalAmount: proceeds,
        bookedDepreciation: new Decimal(0),
        revaluationReserve: new Decimal(0),
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.DISPOSE,
      amount: gross,
      eventDate: date,
      transactionId,
      note: dto.note,
    });

    return {
      asset: updated,
      event,
      transactionId,
      nbv: nbv.toString(),
      gainLoss: net.toString(),
    };
  }

  private async transferInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: TransferFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const dept = await tx.department.findFirst({
      where: { id: dto.toDepartmentId, organizationId },
    });
    if (!dept) throw new NotFoundException("Target department not found");

    const date = dto.date ? new Date(dto.date) : new Date();
    const fromDepartmentId = asset.departmentId;

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        departmentId: dto.toDepartmentId,
        location: dto.location?.trim() || asset.location,
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.TRANSFER,
      amount: new Decimal(0),
      eventDate: date,
      fromDepartmentId,
      toDepartmentId: dto.toDepartmentId,
      note: dto.note,
    });

    return { asset: updated, event, transactionId: null };
  }

  private async gratuitousInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: GratuitousInFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount =
      dto.amount != null
        ? roundMoney2(new Decimal(dto.amount))
        : roundMoney2(new Decimal(asset.purchasePrice));
    const date = dto.date ? new Date(dto.date) : asset.purchaseDate;

    const [fixedAssetCostCode, incomeCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, "INVENTORY_SURPLUS_INCOME", tx),
    ]);

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-GIN-${asset.inventoryNumber}`,
      description: `Fixed asset gratuitous in: ${asset.name}`,
      isFinal: true,
      departmentId: asset.departmentId,
      lines: [
        { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
        { accountCode: incomeCode, debit: "0", credit: amount.toString() },
      ],
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: { purchasePrice: amount },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.GRATUITOUS_IN,
      amount,
      eventDate: date,
      transactionId,
      note: dto.note,
    });

    return { asset: updated, event, transactionId };
  }

  private async gratuitousOutInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: GratuitousOutFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const gross = roundMoney2(new Decimal(asset.purchasePrice));
    const accDep = roundMoney2(new Decimal(asset.bookedDepreciation));
    const nbv = roundMoney2(gross.sub(accDep));
    const date = dto.date ? new Date(dto.date) : new Date();

    const [accumulatedDepreciationCode, fixedAssetCostCode, disposalLossCode] =
      await Promise.all([
        this.posting.resolveAccountCode(organizationId, "ACCUMULATED_DEPRECIATION", tx),
        this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
        this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
      ]);

    const lines: { accountCode: string; debit: string; credit: string }[] = [];
    if (accDep.gt(0)) {
      lines.push({
        accountCode: accumulatedDepreciationCode,
        debit: accDep.toString(),
        credit: "0",
      });
    }
    if (nbv.gt(0)) {
      lines.push({
        accountCode: disposalLossCode,
        debit: nbv.toString(),
        credit: "0",
      });
    }
    lines.push({
      accountCode: fixedAssetCostCode,
      debit: "0",
      credit: gross.toString(),
    });

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-GOUT-${asset.inventoryNumber}`,
      description: `Fixed asset gratuitous out: ${asset.name}`,
      isFinal: true,
      departmentId: asset.departmentId,
      lines,
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        status: FixedAssetStatus.DISPOSED,
        disposalDate: date,
        disposalAmount: new Decimal(0),
        bookedDepreciation: new Decimal(0),
        revaluationReserve: new Decimal(0),
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.GRATUITOUS_OUT,
      amount: gross,
      eventDate: date,
      transactionId,
      note: dto.note,
    });

    return { asset: updated, event, transactionId, nbv: nbv.toString() };
  }

  private async inventoryInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
    dto: InventoryFixedAssetDto,
  ) {
    const asset = await this.getActiveAsset(tx, organizationId, assetId);
    const amount = roundMoney2(new Decimal(dto.amount));
    const date = dto.date ? new Date(dto.date) : new Date();

    const [fixedAssetCostCode, surplusCode, lossCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "FIXED_ASSET_COST", tx),
      this.posting.resolveAccountCode(organizationId, "INVENTORY_SURPLUS_INCOME", tx),
      this.posting.resolveAccountCode(organizationId, "ASSET_DISPOSAL_LOSS", tx),
    ]);

    const isSurplus = dto.direction === FixedAssetInventoryDirection.SURPLUS;
    const lines = isSurplus
      ? [
          { accountCode: fixedAssetCostCode, debit: amount.toString(), credit: "0" },
          { accountCode: surplusCode, debit: "0", credit: amount.toString() },
        ]
      : [
          { accountCode: lossCode, debit: amount.toString(), credit: "0" },
          { accountCode: fixedAssetCostCode, debit: "0", credit: amount.toString() },
        ];

    const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
      organizationId,
      date,
      reference: `FA-INV-${asset.inventoryNumber}`,
      description: `Fixed asset inventory ${dto.direction}: ${asset.name}`,
      isFinal: true,
      departmentId: asset.departmentId,
      lines,
    });

    const updated = await tx.fixedAsset.update({
      where: { id: assetId },
      data: {
        purchasePrice: isSurplus ? { increment: amount } : { decrement: amount },
      },
    });

    const event = await this.createEvent(tx, {
      organizationId,
      fixedAssetId: assetId,
      eventType: FixedAssetEventType.INVENTORY,
      amount,
      eventDate: date,
      transactionId,
      note: dto.note,
    });

    return { asset: updated, event, transactionId };
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    data: {
      organizationId: string;
      fixedAssetId: string;
      eventType: FixedAssetEventType;
      amount: Prisma.Decimal;
      eventDate: Date;
      transactionId?: string | null;
      fromDepartmentId?: string | null;
      toDepartmentId?: string | null;
      note?: string;
    },
  ) {
    return tx.fixedAssetEvent.create({
      data: {
        organizationId: data.organizationId,
        fixedAssetId: data.fixedAssetId,
        eventType: data.eventType,
        amount: data.amount,
        eventDate: data.eventDate,
        transactionId: data.transactionId ?? null,
        fromDepartmentId: data.fromDepartmentId ?? null,
        toDepartmentId: data.toDepartmentId ?? null,
        note: data.note?.trim() || null,
      },
    });
  }

  private async getActiveAsset(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assetId: string,
  ) {
    const asset = await tx.fixedAsset.findFirst({
      where: { id: assetId, organizationId },
    });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    if (asset.status === FixedAssetStatus.DISPOSED) {
      throw new BadRequestException("Asset is already disposed");
    }
    return asset;
  }

  private creditRoleForSource(source: FixedAssetCreditSource): PostingRole {
    return source === FixedAssetCreditSource.SUPPLIER ? "SUPPLIER_PAYABLE" : "MAIN_BANK";
  }

  private assertCreditSource(
    source: FixedAssetCreditSource,
    counterpartyId?: string,
  ): void {
    if (source === FixedAssetCreditSource.SUPPLIER && !counterpartyId) {
      throw new BadRequestException(
        "counterpartyId is required when creditSource is SUPPLIER",
      );
    }
  }
}
