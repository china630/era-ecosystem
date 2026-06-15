import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AmlSeverity, TxnStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import {
  registerPostingCommittedHandler,
  type PostingCommittedPayload,
} from "../../kernel/posting-engine/posting-hooks.registry";
import {
  evaluateCrossBorder,
  evaluateHighRiskCustomer,
  evaluateStructuring,
  evaluateThresholdSingleTxn,
  evaluateVelocity24h,
  type RuleParams,
} from "./aml-rules.engine";
import { AmlService } from "./aml.service";
@Injectable()
export class AmlMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(AmlMonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly aml: AmlService,
    private readonly events: OrchestratorEventsPublisher,
  ) {}

  onModuleInit() {
    registerPostingCommittedHandler((payload) => this.evaluatePostedTransaction(payload));
  }

  async evaluatePostedTransaction(payload: PostingCommittedPayload) {
    if (payload.bankOrgId !== this.bankOrg.bankOrgId) return;

    const rules = await this.prisma.amlRule.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, enabled: true },
    });
    if (rules.length === 0) return;

    const accountId = payload.entries.find((e) => e.accountId)?.accountId ?? undefined;
    let customerId: string | undefined;
    let customerRiskRating = null as import("@era/bank-core-database").RiskRating | null;
    if (accountId) {
      const account = await this.prisma.account.findFirst({ where: { id: accountId } });
      if (account) {
        customerId = account.customerId;
        const customer = await this.prisma.bankCustomer.findFirst({
          where: { id: account.customerId },
        });
        customerRiskRating = customer?.riskRating ?? null;
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEntries = accountId
      ? await this.prisma.journalEntry.findMany({
          where: {
            bankOrgId: this.bankOrg.bankOrgId,
            accountId,
            createdAt: { gte: since },
            transaction: { status: TxnStatus.POSTED },
          },
        })
      : [];
    const velocity24hMinor = recentEntries.reduce((sum, e) => sum + e.debitMinor, 0n);

    const thresholdRule = rules.find((r) => r.code === "THRESHOLD_SINGLE_TXN");
    const thresholdMinor = thresholdRule
      ? BigInt((thresholdRule.paramsJson as RuleParams).thresholdMinor ?? 1_500_000)
      : 1_500_000n;
    const recentBelowThreshold = recentEntries.filter(
      (e) => e.debitMinor > 0n && e.debitMinor < thresholdMinor,
    ).length;

    const ctx = {
      transactionId: payload.transactionId,
      legs: payload.entries.map((e) => ({
        accountId: e.accountId,
        debitMinor: e.debitMinor,
        creditMinor: e.creditMinor,
        currency: e.currency,
      })),
      customerId,
      customerRiskRating,
      counterpartyIban: null,
      recentTxnCountBelowThreshold: recentBelowThreshold,
      velocity24hMinor,
    };

    for (const rule of rules) {
      const params = rule.paramsJson as RuleParams;
      let hit = false;
      let narrative = "";
      let amountMinor: bigint | undefined;
      let currency: string | undefined;

      switch (rule.code) {
        case "THRESHOLD_SINGLE_TXN": {
          const r = evaluateThresholdSingleTxn(ctx, params);
          hit = r.hit;
          amountMinor = r.amountMinor;
          currency = r.currency;
          narrative = "Single transaction above AML threshold";
          break;
        }
        case "VELOCITY_24H":
          hit = evaluateVelocity24h(ctx, params);
          narrative = "24h velocity limit exceeded";
          amountMinor = velocity24hMinor;
          currency = "AZN";
          break;
        case "STRUCTURING_PATTERN":
          hit = evaluateStructuring(ctx, params);
          narrative = "Possible structuring below threshold";
          break;
        case "HIGH_RISK_CUSTOMER":
          hit = evaluateHighRiskCustomer(ctx);
          narrative = "High-risk customer transaction";
          break;
        case "CROSS_BORDER":
          hit = evaluateCrossBorder(ctx);
          narrative = "Cross-border counterparty pattern";
          break;
        default:
          continue;
      }

      if (!hit) continue;

      const alert = await this.aml.raiseAlert({
        ruleCode: rule.code,
        narrative,
        severity: rule.code === "HIGH_RISK_CUSTOMER" ? AmlSeverity.HIGH : AmlSeverity.MEDIUM,
        customerId,
        transactionId: payload.transactionId,
        amountMinor,
        currency,
      });

      await this.events.publishAmlAlertRaised({
        alertId: alert.id,
        ruleCode: rule.code,
        severity: alert.severity,
      }).catch((err) => {
        this.logger.warn(`AML event publish failed: ${(err as Error).message}`);
      });
    }
  }
}
