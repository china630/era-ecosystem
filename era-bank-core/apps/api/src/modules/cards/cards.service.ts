import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AmlSeverity,
  CardStatus,
  CardTxnStatus,
  CardTxnType,
  KycStatus,
  Prisma,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { LedgerService } from "../../kernel/ledger/ledger.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { AmlService } from "../aml/aml.service";
import {
  exceedsPerTxnLimit,
  generateAuthCode,
  isHighRiskMcc,
  parseCardLimits,
} from "./card-txn.engine";
import { MockAzeriCardGateway } from "./gateway/mock-azericard.gateway";

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly ledger: LedgerService,
    private readonly systemGl: SystemGlConfigService,
    private readonly postingEngine: PostingEngineService,
    private readonly aml: AmlService,
    private readonly gateway: MockAzeriCardGateway,
    private readonly events: OrchestratorEventsPublisher,
  ) {}

  list(filters?: { customerId?: string; accountId?: string; status?: CardStatus }) {
    return this.prisma.card.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: filters?.customerId,
        accountId: filters?.accountId,
        status: filters?.status,
      },
      orderBy: { issuedAt: "desc" },
    });
  }

  getById(id: string) {
    return this.prisma.card.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
  }

  listTransactions(filters?: { cardId?: string; status?: CardTxnStatus }) {
    return this.prisma.cardTransaction.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        cardId: filters?.cardId,
        status: filters?.status,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  getTransaction(id: string) {
    return this.prisma.cardTransaction.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { card: true },
    });
  }

  async issue(input: {
    customerId: string;
    accountId: string;
    branchId: string;
    panLast4: string;
    bin6: string;
    expiryMonth: number;
    expiryYear: number;
    limitsJson: Record<string, unknown>;
    makerUserId?: string;
  }) {
    const customer = await this.prisma.bankCustomer.findFirst({
      where: { id: input.customerId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!customer || customer.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException("Customer KYC must be VERIFIED to issue card");
    }
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, bankOrgId: this.bankOrg.bankOrgId, customerId: input.customerId },
    });
    if (!account || account.status !== "ACTIVE") {
      throw new BadRequestException("Account must be ACTIVE");
    }

    const cardToken = `card_${Date.now()}_${input.panLast4}`;
    const registration = await this.gateway.registerCard({
      cardToken,
      panLast4: input.panLast4,
      bin6: input.bin6,
      customerId: input.customerId,
    });

    const card = await this.prisma.card.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        accountId: input.accountId,
        branchId: input.branchId,
        cardToken: registration.processorToken,
        panLast4: input.panLast4,
        bin6: input.bin6,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        limitsJson: input.limitsJson as Prisma.InputJsonValue,
        issuedAt: new Date(),
        status: CardStatus.ACTIVE,
      },
    });

    await this.prisma.cardProcessorMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        direction: "OUTBOUND",
        gateway: this.gateway.name,
        payloadJson: registration.payload as Prisma.InputJsonValue,
        cardTxnId: null,
      },
    });

    await this.events.publishCardIssued({
      cardId: card.id,
      customerId: card.customerId,
      panLast4: card.panLast4,
    }).catch(() => undefined);

    return card;
  }

  async updateLimits(id: string, limitsJson: Record<string, unknown>) {
    const card = await this.getById(id);
    if (!card) throw new NotFoundException("Card not found");
    return this.prisma.card.update({
      where: { id },
      data: { limitsJson: limitsJson as Prisma.InputJsonValue },
    });
  }

  async block(id: string, reason: string) {
    const card = await this.getById(id);
    if (!card) throw new NotFoundException("Card not found");
    return this.prisma.card.update({
      where: { id },
      data: { status: CardStatus.BLOCKED, blockReason: reason },
    });
  }

  async unblock(id: string) {
    const card = await this.getById(id);
    if (!card) throw new NotFoundException("Card not found");
    return this.prisma.card.update({
      where: { id },
      data: { status: CardStatus.ACTIVE, blockReason: null },
    });
  }

  async close(id: string) {
    const card = await this.getById(id);
    if (!card) throw new NotFoundException("Card not found");
    return this.prisma.card.update({
      where: { id },
      data: { status: CardStatus.CLOSED, closedAt: new Date() },
    });
  }

  async authorize(input: {
    cardId?: string;
    cardToken?: string;
    amountMinor: bigint;
    currency: string;
    processorRef: string;
    merchantName?: string;
    mcc?: string;
  }) {
    const existing = await this.prisma.cardTransaction.findUnique({
      where: { processorRef: input.processorRef },
    });
    if (existing) return existing;

    const card = await this.resolveCard(input.cardId, input.cardToken);
    if (!card) throw new NotFoundException("Card not found");
    if (card.status !== CardStatus.ACTIVE) {
      return this.decline(card, input, "CARD_NOT_ACTIVE");
    }

    const limits = parseCardLimits(card.limitsJson);
    if (exceedsPerTxnLimit(input.amountMinor, limits)) {
      return this.decline(card, input, "LIMIT_EXCEEDED");
    }

    const account = await this.prisma.account.findFirst({
      where: { id: card.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) return this.decline(card, input, "ACCOUNT_NOT_FOUND");

    const holds = await this.prisma.accountHold.aggregate({
      where: { accountId: account.id, status: "ACTIVE" },
      _sum: { amountMinor: true },
    });
    const held = holds._sum.amountMinor ?? 0n;
    const available = account.ledgerBalanceMinor - held + account.overdraftLimitMinor;
    if (input.amountMinor > available) {
      const declined = await this.decline(card, input, "INSUFFICIENT_FUNDS");
      await this.events.publishCardTxnDeclined({
        cardTxnId: declined.id,
        declineReason: "INSUFFICIENT_FUNDS",
        amountMinor: Number(input.amountMinor),
      }).catch(() => undefined);
      return declined;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const hold = await this.ledger.placeHold(
      card.accountId,
      input.amountMinor,
      "CARD_AUTH",
      expiresAt,
    );

    await this.gateway.forwardAuthorize({
      processorRef: input.processorRef,
      amountMinor: input.amountMinor.toString(),
      cardToken: card.cardToken,
    });

    const authCode = generateAuthCode();
    const txn = await this.prisma.cardTransaction.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        cardId: card.id,
        accountId: card.accountId,
        holdId: hold.id,
        type: CardTxnType.AUTH,
        status: CardTxnStatus.APPROVED,
        amountMinor: input.amountMinor,
        currency: input.currency,
        merchantName: input.merchantName,
        merchantMcc: input.mcc,
        processorRef: input.processorRef,
        authCode,
        authorizedAt: new Date(),
      },
    });

    await this.prisma.cardProcessorMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        direction: "INBOUND",
        gateway: this.gateway.name,
        payloadJson: { action: "authorize", processorRef: input.processorRef } as Prisma.InputJsonValue,
        cardTxnId: txn.id,
      },
    });

    return txn;
  }

  async capture(input: { authTxnId?: string; processorRef?: string; amountMinor?: bigint }) {
    const authTxn = await this.prisma.cardTransaction.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(input.authTxnId ? { id: input.authTxnId } : {}),
        ...(input.processorRef ? { processorRef: input.processorRef } : {}),
        type: CardTxnType.AUTH,
        status: CardTxnStatus.APPROVED,
      },
    });
    if (!authTxn) throw new NotFoundException("Approved auth transaction not found");
    if (!authTxn.holdId) throw new NotFoundException("Auth hold missing");

    const captureAmount = input.amountMinor ?? authTxn.amountMinor;
    if (captureAmount > authTxn.amountMinor) {
      throw new BadRequestException("Capture amount exceeds authorization");
    }

    const card = await this.prisma.card.findFirst({ where: { id: authTxn.cardId } });
    if (isHighRiskMcc(authTxn.merchantMcc)) {
      await this.aml.raiseAlert({
        ruleCode: "CARD_HIGH_RISK_MCC",
        narrative: `Card capture at high-risk MCC ${authTxn.merchantMcc}`,
        severity: AmlSeverity.HIGH,
        customerId: card?.customerId,
        amountMinor: captureAmount,
        currency: authTxn.currency,
      });
    }

    const account = await this.prisma.account.findFirst({
      where: { id: authTxn.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const settlementGl = await this.systemGl.resolve(SystemGlKey.NOSTRO);

    const posting = await this.postingEngine.post({
      reference: `CARD-CAP-${authTxn.processorRef}`,
      idempotencyKey: `card-cap-${authTxn.processorRef}`,
      valueDate: new Date(),
      type: TxnType.PAYMENT,
      makerUserId: `cards:${authTxn.cardId}`,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: captureAmount,
          creditMinor: 0n,
          currency: authTxn.currency,
        },
        {
          glAccountId: settlementGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: captureAmount,
          currency: authTxn.currency,
        },
      ],
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.accountHold.updateMany({
        where: { id: authTxn.holdId!, accountId: authTxn.accountId, status: "ACTIVE" },
        data: { status: "CAPTURED" },
      });
      return tx.cardTransaction.update({
        where: { id: authTxn.id },
        data: {
          type: CardTxnType.CAPTURE,
          status: CardTxnStatus.SETTLED,
          amountMinor: captureAmount,
          postingTxnId: posting.id,
          capturedAt: new Date(),
        },
      });
    });
  }

  async reverse(authTxnId: string) {
    const authTxn = await this.prisma.cardTransaction.findFirst({
      where: {
        id: authTxnId,
        bankOrgId: this.bankOrg.bankOrgId,
        type: CardTxnType.AUTH,
        status: CardTxnStatus.APPROVED,
      },
    });
    if (!authTxn?.holdId) throw new NotFoundException("Reversible auth not found");

    await this.ledger.releaseHold(authTxn.accountId, authTxn.holdId);
    return this.prisma.cardTransaction.update({
      where: { id: authTxn.id },
      data: { status: CardTxnStatus.REVERSED, type: CardTxnType.REVERSAL },
    });
  }

  acquiringAuthorize(input: {
    cardToken: string;
    amountMinor: bigint;
    currency: string;
    processorRef: string;
    merchantName?: string;
    mcc?: string;
  }) {
    return this.authorize({
      cardToken: input.cardToken,
      amountMinor: input.amountMinor,
      currency: input.currency,
      processorRef: input.processorRef,
      merchantName: input.merchantName,
      mcc: input.mcc,
    });
  }

  acquiringCapture(input: { processorRef: string; amountMinor?: bigint }) {
    return this.capture(input);
  }

  async expireStaleAuthHolds() {
    const now = new Date();
    const stale = await this.prisma.accountHold.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "ACTIVE",
        reason: "CARD_AUTH",
        expiresAt: { lt: now },
      },
    });
    for (const hold of stale) {
      await this.ledger.releaseHold(hold.accountId, hold.id);
    }
    return { expiredCount: stale.length };
  }

  private async resolveCard(cardId?: string, cardToken?: string) {
    if (cardId) {
      return this.prisma.card.findFirst({
        where: { id: cardId, bankOrgId: this.bankOrg.bankOrgId },
      });
    }
    if (cardToken) {
      return this.prisma.card.findFirst({
        where: { cardToken, bankOrgId: this.bankOrg.bankOrgId },
      });
    }
    return null;
  }

  private async decline(
    card: { id: string; accountId: string },
    input: {
      cardId?: string;
      amountMinor: bigint;
      currency: string;
      processorRef: string;
      merchantName?: string;
      mcc?: string;
    },
    reason: string,
  ) {
    return this.prisma.cardTransaction.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        cardId: card.id,
        accountId: card.accountId,
        type: CardTxnType.AUTH,
        status: CardTxnStatus.DECLINED,
        amountMinor: input.amountMinor,
        currency: input.currency,
        merchantName: input.merchantName,
        merchantMcc: input.mcc,
        processorRef: input.processorRef,
        declineReason: reason,
        authorizedAt: new Date(),
      },
    });
  }
}
