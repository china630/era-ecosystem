import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActiveStatus,
  FxDealStatus,
  FxDealType,
  NostroDirection,
  PaymentOrderStatus,
  PlacementStatus,
  PositionStatus,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { DataHubClient } from "../../integration/data-hub.client";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import {
  buildGapBuckets,
  computeLcrRatioStub,
  dayOffsetFrom,
} from "./liquidity-gap.engine";

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
    private readonly dataHub: DataHubClient,
    private readonly events: OrchestratorEventsPublisher,
  ) {}

  listNostroVostro() {
    return this.prisma.nostroVostroAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { iban: "asc" },
    });
  }

  async registerNostroVostro(input: {
    direction: NostroDirection;
    iban: string;
    currency: string;
    glAccountCode: string;
    counterpartyId?: string;
  }) {
    const gl = await this.glByCode(input.glAccountCode);
    return this.prisma.nostroVostroAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        direction: input.direction,
        iban: input.iban,
        currency: input.currency,
        glAccountId: gl.id,
        counterpartyId: input.counterpartyId,
        status: ActiveStatus.ACTIVE,
      },
    });
  }

  async nostroStatement(id: string) {
    const nostro = await this.nostroById(id);
    const entries = await this.prisma.journalEntry.findMany({
      where: { glAccountId: nostro.glAccountId, bankOrgId: this.bankOrg.bankOrgId },
      include: { transaction: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { nostro, movements: entries };
  }

  async reconcileNostro(id: string, statementBalanceMinor: bigint) {
    const nostro = await this.nostroById(id);
    const varianceMinor = nostro.ledgerBalanceMinor - statementBalanceMinor;
    return {
      nostroId: id,
      ledgerBalanceMinor: nostro.ledgerBalanceMinor.toString(),
      statementBalanceMinor: statementBalanceMinor.toString(),
      varianceMinor: varianceMinor.toString(),
      matched: varianceMinor === 0n,
    };
  }

  listFxDeals() {
    return this.prisma.fxDeal.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  getFxDeal(id: string) {
    return this.prisma.fxDeal.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  async bookFxDeal(input: {
    baseCurrency: string;
    quoteCurrency: string;
    baseAmountMinor: bigint;
    quoteAmountMinor: bigint;
    rate: number;
    valueDate: Date;
    bookedByUserId: string;
    idempotencyKey: string;
  }) {
    const existing = await this.prisma.fxDeal.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const branch = await this.headOfficeBranch();
    const fxTransit = await this.systemGl.resolve(SystemGlKey.FX_TRANSIT);
    const nostroGl = await this.systemGl.resolve(SystemGlKey.NOSTRO);

    const posting = await this.postingEngine.post({
      reference: `FX-SPOT-${input.idempotencyKey}`,
      idempotencyKey: `fx-book-${input.idempotencyKey}`,
      valueDate: input.valueDate,
      type: TxnType.FX,
      makerUserId: input.bookedByUserId,
      branchId: branch.id,
      autoApprove: true,
      legs: [
        {
          glAccountId: fxTransit.id,
          branchId: branch.id,
          debitMinor: input.quoteAmountMinor,
          creditMinor: 0n,
          currency: input.quoteCurrency,
        },
        {
          glAccountId: nostroGl.id,
          branchId: branch.id,
          debitMinor: 0n,
          creditMinor: input.quoteAmountMinor,
          currency: input.quoteCurrency,
        },
      ],
    });

    return this.prisma.fxDeal.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        dealType: FxDealType.SPOT,
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        baseAmountMinor: input.baseAmountMinor,
        quoteAmountMinor: input.quoteAmountMinor,
        rate: input.rate,
        valueDate: input.valueDate,
        status: FxDealStatus.BOOKED,
        postingTxnId: posting.id,
        bookedByUserId: input.bookedByUserId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async settleFxDeal(id: string, settledByUserId: string) {
    const deal = await this.getFxDeal(id);
    if (!deal) throw new NotFoundException("FX deal not found");
    if (deal.status !== FxDealStatus.BOOKED) {
      throw new BadRequestException("Only BOOKED deals can be settled");
    }
    return this.prisma.fxDeal.update({
      where: { id },
      data: { status: FxDealStatus.SETTLED },
    });
  }

  async cancelFxDeal(id: string, cancelledByUserId: string) {
    const deal = await this.getFxDeal(id);
    if (!deal) throw new NotFoundException("FX deal not found");
    if (deal.status === FxDealStatus.SETTLED) {
      throw new BadRequestException("Cannot cancel settled deal");
    }
    if (deal.postingTxnId) {
      await this.postingEngine.reverse({
        transactionId: deal.postingTxnId,
        makerUserId: cancelledByUserId,
        reason: "FX deal cancelled",
        idempotencyKey: `fx-cancel-${deal.id}`,
      });
    }
    return this.prisma.fxDeal.update({
      where: { id },
      data: { status: FxDealStatus.CANCELLED },
    });
  }

  listInterbank() {
    return this.prisma.interbankPlacement.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { startDate: "desc" },
    });
  }

  async placeInterbank(input: {
    counterpartyId: string;
    nostroAccountId: string;
    principalMinor: bigint;
    currency: string;
    rateAnnual: number;
    startDate: Date;
    maturityDate: Date;
    bookedByUserId: string;
    idempotencyKey: string;
  }) {
    const branch = await this.headOfficeBranch();
    const placementGl = await this.systemGl.resolve(SystemGlKey.INTERBANK_PLACEMENT);
    const nostro = await this.nostroById(input.nostroAccountId);
    const nostroGl = await this.prisma.glAccount.findFirst({
      where: { id: nostro.glAccountId },
    });
    if (!nostroGl) throw new NotFoundException("Nostro GL missing");

    const posting = await this.postingEngine.post({
      reference: `IB-OPEN-${input.idempotencyKey}`,
      idempotencyKey: `ib-open-${input.idempotencyKey}`,
      valueDate: input.startDate,
      type: TxnType.TRANSFER,
      makerUserId: input.bookedByUserId,
      branchId: branch.id,
      autoApprove: true,
      legs: [
        {
          glAccountId: placementGl.id,
          branchId: branch.id,
          debitMinor: input.principalMinor,
          creditMinor: 0n,
          currency: input.currency,
        },
        {
          glAccountId: nostroGl.id,
          branchId: branch.id,
          debitMinor: 0n,
          creditMinor: input.principalMinor,
          currency: input.currency,
        },
      ],
    });

    const placement = await this.prisma.interbankPlacement.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        counterpartyId: input.counterpartyId,
        nostroAccountId: input.nostroAccountId,
        principalMinor: input.principalMinor,
        currency: input.currency,
        rateAnnual: input.rateAnnual,
        startDate: input.startDate,
        maturityDate: input.maturityDate,
        status: PlacementStatus.ACTIVE,
        openPostingTxnId: posting.id,
      },
    });

    await this.prisma.nostroVostroAccount.update({
      where: { id: nostro.id },
      data: { ledgerBalanceMinor: { decrement: input.principalMinor } },
    });

    return placement;
  }

  async matureInterbank(id: string, maturedByUserId: string) {
    const placement = await this.prisma.interbankPlacement.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!placement) throw new NotFoundException("Placement not found");
    if (placement.status !== PlacementStatus.ACTIVE) {
      throw new BadRequestException("Placement not active");
    }

    const branch = await this.headOfficeBranch();
    const placementGl = await this.systemGl.resolve(SystemGlKey.INTERBANK_PLACEMENT);
    const nostroGl = await this.systemGl.resolve(SystemGlKey.NOSTRO);
    const incomeGl = await this.systemGl.resolve(SystemGlKey.INTEREST_INCOME);

    const days =
      (placement.maturityDate.getTime() - placement.startDate.getTime()) / 86400000;
    const interestMinor = BigInt(
      Math.round(
        Number(placement.principalMinor) *
          Number(placement.rateAnnual) *
          (days / 365),
      ),
    );
    const totalReturn = placement.principalMinor + interestMinor;

    const posting = await this.postingEngine.post({
      reference: `IB-MATURE-${placement.id}`,
      idempotencyKey: `ib-mature-${placement.id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: maturedByUserId,
      branchId: branch.id,
      autoApprove: true,
      legs: [
        {
          glAccountId: nostroGl.id,
          branchId: branch.id,
          debitMinor: totalReturn,
          creditMinor: 0n,
          currency: placement.currency,
        },
        {
          glAccountId: placementGl.id,
          branchId: branch.id,
          debitMinor: 0n,
          creditMinor: placement.principalMinor,
          currency: placement.currency,
        },
        {
          glAccountId: incomeGl.id,
          branchId: branch.id,
          debitMinor: 0n,
          creditMinor: interestMinor,
          currency: placement.currency,
        },
      ],
    });

    await this.prisma.nostroVostroAccount.update({
      where: { id: placement.nostroAccountId },
      data: { ledgerBalanceMinor: { increment: totalReturn } },
    });

    return this.prisma.interbankPlacement.update({
      where: { id },
      data: {
        status: PlacementStatus.MATURED,
        closePostingTxnId: posting.id,
      },
    });
  }

  listGovSecurities() {
    return this.prisma.govSecurityPosition.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { maturityDate: "asc" },
    });
  }

  async purchaseGovSecurity(input: {
    isin: string;
    faceValueMinor: bigint;
    bookValueMinor: bigint;
    currency: string;
    maturityDate: Date;
    bookedByUserId: string;
    idempotencyKey: string;
  }) {
    const branch = await this.headOfficeBranch();
    const gsGl = await this.systemGl.resolve(SystemGlKey.GOV_SECURITIES);
    const nostroGl = await this.systemGl.resolve(SystemGlKey.NOSTRO);

    await this.postingEngine.post({
      reference: `GS-BUY-${input.isin}`,
      idempotencyKey: `gs-buy-${input.idempotencyKey}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: input.bookedByUserId,
      branchId: branch.id,
      autoApprove: true,
      legs: [
        {
          glAccountId: gsGl.id,
          branchId: branch.id,
          debitMinor: input.bookValueMinor,
          creditMinor: 0n,
          currency: input.currency,
        },
        {
          glAccountId: nostroGl.id,
          branchId: branch.id,
          debitMinor: 0n,
          creditMinor: input.bookValueMinor,
          currency: input.currency,
        },
      ],
    });

    return this.prisma.govSecurityPosition.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        isin: input.isin,
        faceValueMinor: input.faceValueMinor,
        bookValueMinor: input.bookValueMinor,
        currency: input.currency,
        maturityDate: input.maturityDate,
        status: PositionStatus.ACTIVE,
      },
    });
  }

  async matureGovSecurity(id: string, maturedByUserId: string) {
    const position = await this.prisma.govSecurityPosition.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!position) throw new NotFoundException("GS position not found");
    if (position.status !== PositionStatus.ACTIVE) {
      throw new BadRequestException("Position not active");
    }

    const branch = await this.headOfficeBranch();
    const gsGl = await this.systemGl.resolve(SystemGlKey.GOV_SECURITIES);
    const nostroGl = await this.systemGl.resolve(SystemGlKey.NOSTRO);
    const incomeGl = await this.systemGl.resolve(SystemGlKey.INTEREST_INCOME);
    const premium = position.faceValueMinor - position.bookValueMinor;

    const legs = [
      {
        glAccountId: nostroGl.id,
        branchId: branch.id,
        debitMinor: position.faceValueMinor,
        creditMinor: 0n,
        currency: position.currency,
      },
      {
        glAccountId: gsGl.id,
        branchId: branch.id,
        debitMinor: 0n,
        creditMinor: position.bookValueMinor,
        currency: position.currency,
      },
    ];
    if (premium > 0n) {
      legs.push({
        glAccountId: incomeGl.id,
        branchId: branch.id,
        debitMinor: 0n,
        creditMinor: premium,
        currency: position.currency,
      });
    }

    await this.postingEngine.post({
      reference: `GS-MATURE-${position.isin}`,
      idempotencyKey: `gs-mature-${position.id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: maturedByUserId,
      branchId: branch.id,
      autoApprove: true,
      legs,
    });

    return this.prisma.govSecurityPosition.update({
      where: { id },
      data: { status: PositionStatus.MATURED },
    });
  }

  gapHistory(limit = 10) {
    return this.prisma.liquidityGapSnapshot.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { generatedAt: "desc" },
      take: limit,
    });
  }

  async liquidityGap(asOfDate: Date, horizonDays = 30, publishEvent = true) {
    const inflows = new Map<number, bigint>();
    const outflows = new Map<number, bigint>();

    const nostroRows = await this.prisma.nostroVostroAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, status: ActiveStatus.ACTIVE },
    });
    const nostroTotal = nostroRows.reduce((s, r) => s + r.ledgerBalanceMinor, 0n);
    inflows.set(1, (inflows.get(1) ?? 0n) + nostroTotal);

    const gsRows = await this.prisma.govSecurityPosition.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, status: PositionStatus.ACTIVE },
    });
    const gsLiquid = gsRows.reduce(
      (s, r) => s + (r.bookValueMinor * 95n) / 100n,
      0n,
    );
    inflows.set(1, (inflows.get(1) ?? 0n) + gsLiquid);

    const ibRows = await this.prisma.interbankPlacement.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, status: PlacementStatus.ACTIVE },
    });
    for (const ib of ibRows) {
      const offset = Math.min(horizonDays, dayOffsetFrom(asOfDate, ib.maturityDate));
      inflows.set(offset, (inflows.get(offset) ?? 0n) + ib.principalMinor);
    }

    const deposits = await this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        maturityDate: { not: null, lte: new Date(asOfDate.getTime() + horizonDays * 86400000) },
      },
    });
    for (const dep of deposits) {
      if (!dep.maturityDate) continue;
      const offset = Math.min(horizonDays, dayOffsetFrom(asOfDate, dep.maturityDate));
      outflows.set(offset, (outflows.get(offset) ?? 0n) + dep.principalMinor);
    }

    const pendingPayments = await this.prisma.paymentOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: [PaymentOrderStatus.APPROVED, PaymentOrderStatus.SUBMITTED] },
      },
    });
    for (const po of pendingPayments) {
      outflows.set(1, (outflows.get(1) ?? 0n) + po.amountMinor);
    }

    const buckets = buildGapBuckets(horizonDays, inflows, outflows);
    const totalOut30 = buckets.reduce((s, b) => s + b.outflowMinor, 0);
    const liquidAssets =
      Number(nostroTotal) + Number(gsLiquid) + ibRows.reduce((s, r) => s + Number(r.principalMinor), 0);
    const lcrRatioStub = computeLcrRatioStub(BigInt(liquidAssets), BigInt(totalOut30));

    const snapshot = await this.prisma.liquidityGapSnapshot.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate,
        bucketsJson: {
          schemaVersion: 1,
          horizonDays,
          buckets,
          lcrRatioStub,
          assumptions: ["nostro T+1", "GS 95% haircut", "deposit maturity outflows"],
        },
      },
    });

    if (publishEvent) {
      await this.events
        .publishTreasuryGapSnapshot({
          snapshotId: snapshot.id,
          asOfDate: asOfDate.toISOString().slice(0, 10),
          horizonDays,
          lcrRatioStub,
        })
        .catch(() => undefined);
    }

    return snapshot;
  }

  async suggestedFxRate(baseCurrency: string, asOf: Date) {
    if (baseCurrency === "AZN") return 1;
    return this.dataHub.getFxRate(baseCurrency, asOf);
  }

  private async glByCode(code: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!gl) throw new NotFoundException(`GL account ${code} not seeded`);
    return gl;
  }

  private async headOfficeBranch() {
    const branch = await this.prisma.branch.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, isHeadOffice: true },
    });
    if (!branch) throw new NotFoundException("Head office branch not seeded");
    return branch;
  }

  private async nostroById(id: string) {
    const nostro = await this.prisma.nostroVostroAccount.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!nostro) throw new NotFoundException("Nostro/Vostro account not found");
    return nostro;
  }
}
