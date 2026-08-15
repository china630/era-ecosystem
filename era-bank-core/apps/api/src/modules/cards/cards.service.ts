import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AmlSeverity,
  CardDisputeStatus,
  CardStatus,
  CardTxnStatus,
  CardTxnType,
  KycStatus,
  Prisma,
  ThreeDsChallengeStatus,
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
import { ProductFactoryService } from "../../kernel/product-factory/product-factory.service";
import {
  parseProductParams,
  resolveCardLimits,
  type CardProductParams,
} from "../../kernel/product-factory/product-params";
import { AmlService } from "../aml/aml.service";
import {
  assertDisputeTransition,
  THREE_DS_THRESHOLD_MINOR,
} from "../../common/fc2-fc7.util";
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
    private readonly products: ProductFactoryService,
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
    productTemplateId: string;
    panLast4?: string;
    bin6?: string;
    expiryMonth?: number;
    expiryYear?: number;
    limitsJson?: Record<string, unknown>;
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

    const template = await this.products.assertActiveCardProduct(
      input.productTemplateId,
    );
    const productParams = parseProductParams(
      template.kind,
      template.paramsJson,
    ) as CardProductParams;
    const limits = resolveCardLimits({
      product: productParams,
      requested: input.limitsJson
        ? {
            dailySpendLimitMinor:
              typeof input.limitsJson.dailySpendLimitMinor === "number"
                ? input.limitsJson.dailySpendLimitMinor
                : undefined,
            atmDailyLimitMinor:
              typeof input.limitsJson.atmDailyLimitMinor === "number"
                ? input.limitsJson.atmDailyLimitMinor
                : undefined,
            perTxnMaxMinor:
              typeof input.limitsJson.perTxnMaxMinor === "number"
                ? input.limitsJson.perTxnMaxMinor
                : undefined,
          }
        : undefined,
    });

    const panLast4 =
      input.panLast4?.replace(/\D/g, "").slice(-4) ||
      String(1000 + (Date.now() % 9000));
    const bin6 =
      input.bin6?.replace(/\D/g, "").slice(0, 6) ||
      (productParams.scheme.toUpperCase() === "MASTERCARD" ? "545612" : "416598");
    const now = new Date();
    const expiryMonth = input.expiryMonth ?? now.getUTCMonth() + 1;
    const expiryYear = input.expiryYear ?? now.getUTCFullYear() + 3;

    const cardToken = `card_${Date.now()}_${panLast4}`;
    const registration = await this.gateway.registerCard({
      cardToken,
      panLast4,
      bin6,
      customerId: input.customerId,
    });

    const card = await this.prisma.card.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        accountId: input.accountId,
        branchId: input.branchId,
        cardToken: registration.processorToken,
        panLast4,
        bin6,
        expiryMonth,
        expiryYear,
        limitsJson: limits as Prisma.InputJsonValue,
        issuedAt: new Date(),
        status: CardStatus.ACTIVE,
      },
    });

    await this.prisma.cardProcessorMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        direction: "OUTBOUND",
        gateway: this.gateway.name,
        payloadJson: {
          ...registration.payload,
          productTemplateId: input.productTemplateId,
          scheme: productParams.scheme,
          cardType: productParams.cardType,
        } as Prisma.InputJsonValue,
        cardTxnId: null,
      },
    });

    await this.events.publishCardIssued({
      cardId: card.id,
      customerId: card.customerId,
      panLast4: card.panLast4,
    }).catch(() => undefined);

    return {
      ...card,
      productTemplateId: input.productTemplateId,
      scheme: productParams.scheme,
      cardType: productParams.cardType,
    };
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

    if (input.amountMinor > THREE_DS_THRESHOLD_MINOR) {
      const completed = await this.prisma.threeDsChallenge.findFirst({
        where: {
          bankOrgId: this.bankOrg.bankOrgId,
          cardId: card.id,
          amountMinor: input.amountMinor,
          status: ThreeDsChallengeStatus.COMPLETED,
          completedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
        orderBy: { completedAt: "desc" },
      });
      if (!completed) {
        await this.createThreeDs({
          cardId: card.id,
          amountMinor: input.amountMinor,
          currency: input.currency,
        });
        return this.decline(card, input, "3DS_REQUIRED");
      }
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
      { expiresAt },
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

  listDisputes(status?: CardDisputeStatus) {
    return this.prisma.cardDisputeCase.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createDispute(input: {
    cardTransactionId: string;
    amountMinor: bigint;
    currency?: string;
    reasonCode: string;
  }) {
    return this.prisma.cardDisputeCase.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        cardTransactionId: input.cardTransactionId,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        reasonCode: input.reasonCode,
        status: CardDisputeStatus.OPEN,
      },
    });
  }

  async updateDisputeStatus(id: string, status: CardDisputeStatus) {
    const dispute = await this.prisma.cardDisputeCase.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!dispute) throw new NotFoundException("Dispute not found");
    assertDisputeTransition(dispute.status, status);
    return this.prisma.cardDisputeCase.update({
      where: { id },
      data: { status },
    });
  }

  listMerchants() {
    return this.prisma.acquiringMerchant.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { merchantCode: "asc" },
    });
  }

  registerMerchant(input: {
    merchantCode: string;
    name: string;
    mcc?: string;
    authToken?: string;
  }) {
    return this.prisma.acquiringMerchant.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        merchantCode: input.merchantCode,
        name: input.name,
        mcc: input.mcc,
        authToken: input.authToken ?? `mer_${Date.now()}`,
      },
    });
  }

  async authorizeMerchant(input: {
    merchantCode: string;
    authToken: string;
    cardToken: string;
    amountMinor: bigint;
    currency: string;
    processorRef: string;
  }) {
    const merchant = await this.prisma.acquiringMerchant.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        merchantCode: input.merchantCode,
        status: "ACTIVE",
      },
    });
    if (!merchant || merchant.authToken !== input.authToken) {
      throw new BadRequestException("Invalid merchant credentials");
    }
    return this.authorize({
      cardToken: input.cardToken,
      amountMinor: input.amountMinor,
      currency: input.currency,
      processorRef: input.processorRef,
      merchantName: merchant.name,
      mcc: merchant.mcc ?? undefined,
    });
  }

  listThreeDs(cardId?: string) {
    return this.prisma.threeDsChallenge.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(cardId ? { cardId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createThreeDs(input: {
    cardId: string;
    amountMinor: bigint;
    currency?: string;
  }) {
    return this.prisma.threeDsChallenge.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        cardId: input.cardId,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        status: ThreeDsChallengeStatus.PENDING,
      },
    });
  }

  completeThreeDs(id: string, success: boolean) {
    return this.prisma.threeDsChallenge.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: {
        status: success
          ? ThreeDsChallengeStatus.COMPLETED
          : ThreeDsChallengeStatus.FAILED,
        completedAt: new Date(),
      },
    });
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
