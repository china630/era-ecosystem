import { Injectable, Logger } from "@nestjs/common";
import {
  BillingStatus,
  Prisma,
  SubscriptionInvoiceStatus,
  TariffTier,
  UserRole,
} from "@erafinance/database";
import { Prisma as ControlPrisma } from "@era365/database";
import { resolveOrganizationUuid } from "../common/organization-id.util";
import { ControlPlanePrismaService } from "../control-plane/control-plane-prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  MeterUnitPricing,
  SystemConfigService,
} from "../system-config/system-config.service";
import { billingPeriodKeyBaku } from "./baku-billing.util";
import { CreditExceededException } from "./credit-exceeded.exception";
import type { BillableActionType } from "./billing-rate-card";
import {
  DEFAULT_TIER_SPEND_CEILINGS_AZN,
  nextTariffTier,
  spendReachedTierCeiling,
  TIER_SPEND_CEILING_KEYS,
} from "./tier-spend-ceiling";

export type MeterBillableKind =
  | "USER_MONTHLY"
  | "STORAGE_GB_MONTHLY"
  | "WHATSAPP_ALERT"
  | "INVOICE_CREATED"
  | "OCR_PAGE";

const KIND_TO_ACTION: Record<MeterBillableKind, BillableActionType> = {
  USER_MONTHLY: "USER_MONTHLY",
  STORAGE_GB_MONTHLY: "ORG_WORKSPACE_MONTHLY",
  WHATSAPP_ALERT: "WHATSAPP_ALERT",
  INVOICE_CREATED: "INVOICE_CREATED",
  OCR_PAGE: "OCR_PAGE",
};

@Injectable()
export class BillingMeterService {
  private readonly logger = new Logger(BillingMeterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async getTierSpendCeiling(tier: TariffTier): Promise<number> {
    const raw = await this.systemConfig.getJson(TIER_SPEND_CEILING_KEYS[tier]);
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) return n;
    }
    return DEFAULT_TIER_SPEND_CEILINGS_AZN[tier];
  }

  async getAllTierSpendCeilings(): Promise<Record<TariffTier, number>> {
    const tiers = Object.keys(TIER_SPEND_CEILING_KEYS) as TariffTier[];
    const out = { ...DEFAULT_TIER_SPEND_CEILINGS_AZN };
    for (const tier of tiers) {
      out[tier] = await this.getTierSpendCeiling(tier);
    }
    return out;
  }

  async setTierSpendCeiling(tier: TariffTier, ceilingAzn: number): Promise<void> {
    await this.systemConfig.setJson(
      TIER_SPEND_CEILING_KEYS[tier],
      Math.max(0, ceilingAzn),
    );
  }

  async assertBillingNotHardBlocked(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { billingStatus: true },
    });
    if (org?.billingStatus === BillingStatus.HARD_BLOCK) {
      throw new CreditExceededException(
        "CREDIT_HARD_LOCK",
        undefined,
        "Payment required — organization is in billing hard block.",
      );
    }
  }

  async getMonthlySpendAzn(organizationId: string): Promise<number> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return 0;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { accumulatedBalance: true, billingPeriodKey: true },
    });
    const period = billingPeriodKeyBaku();
    if (org?.billingPeriodKey && org.billingPeriodKey !== period) {
      return 0;
    }
    return Number(org?.accumulatedBalance ?? 0);
  }

  /**
   * Records metered spend, persists UsageMeterEvent, enforces tier spend ceiling (intraday).
   */
  async recordUsage(
    organizationId: string,
    kind: MeterBillableKind,
    quantity = 1,
  ): Promise<{ spentAzn: number; addedAzn: number }> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return { spentAzn: 0, addedAzn: 0 };

    await this.assertBillingNotHardBlocked(orgId);

    const unit = await this.systemConfig.getMeterUnitPricing();
    const unitPrice = this.unitPriceFor(kind, unit);
    const qty = Math.max(0, quantity);
    const addedAzn = Math.round(unitPrice * qty * 100) / 100;
    if (addedAzn <= 0) {
      return { spentAzn: await this.getMonthlySpendAzn(orgId), addedAzn: 0 };
    }

    const periodKey = billingPeriodKeyBaku();
    const actionType = KIND_TO_ACTION[kind];

    const sub = await this.controlPlane.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { currentTier: true },
    });
    const tier = sub?.currentTier ?? TariffTier.TIER_0;
    const ceiling = await this.getTierSpendCeiling(tier);

    const { spentAzn, addedAzn: added } = await this.prisma.$transaction(
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          select: {
            accumulatedBalance: true,
            billingPeriodKey: true,
          },
        });
        if (!org) return { spentAzn: 0, addedAzn: 0 };

        let balance = Number(org.accumulatedBalance ?? 0);
        if (org.billingPeriodKey !== periodKey) {
          balance = 0;
        }
        balance = Math.round((balance + addedAzn) * 100) / 100;

        await tx.organization.update({
          where: { id: orgId },
          data: {
            accumulatedBalance: new Prisma.Decimal(balance),
            billingPeriodKey: periodKey,
          },
        });

        await this.controlPlane.usageMeterEvent.create({
          data: {
            organizationId: orgId,
            actionType,
            quantity: qty,
            unitCostAzn: new ControlPrisma.Decimal(unitPrice),
            balanceAfter: new ControlPrisma.Decimal(balance),
          },
        });

        await this.controlPlane.organizationSubscription.updateMany({
          where: { organizationId: orgId },
          data: { billingPeriodKey: periodKey },
        });

        return { spentAzn: balance, addedAzn };
      },
    );

    if (spendReachedTierCeiling(spentAzn, ceiling)) {
      await this.ensureIntradayTierInvoice(orgId, tier, ceiling, spentAzn);
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { billingStatus: BillingStatus.SOFT_BLOCK },
      });
      throw new CreditExceededException(
        "USAGE_CAP_EXCEEDED",
        actionType,
        `Monthly spend ceiling reached for ${tier} (${ceiling} AZN). Pay the tier invoice to continue.`,
      );
    }

    return { spentAzn, addedAzn: added };
  }

  unitPriceFor(kind: MeterBillableKind, unit: MeterUnitPricing): number {
    switch (kind) {
      case "USER_MONTHLY":
        return unit.pricePerUserMonthAzn;
      case "STORAGE_GB_MONTHLY":
        return unit.pricePerGbMonthAzn;
      case "WHATSAPP_ALERT":
        return unit.pricePerWhatsappAlertAzn;
      case "INVOICE_CREATED":
        return unit.pricePerInvoiceAzn;
      case "OCR_PAGE":
        return unit.pricePerOcrPageAzn;
      default:
        return 0;
    }
  }

  async resetMonthlySpendAfterInvoiced(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        accumulatedBalance: new Prisma.Decimal(0),
        billingPeriodKey: billingPeriodKeyBaku(),
        billingStatus: BillingStatus.ACTIVE,
      },
    });
  }

  /**
   * Idempotent same-day tier-ceiling invoice for owner (PRD §16.4 intraday).
   */
  async ensureIntradayTierInvoice(
    organizationId: string,
    tier: TariffTier,
    ceilingAzn: number,
    spentAzn: number,
  ): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;

    const ownerId = await this.resolveOwnerUserId(orgId);
    if (!ownerId) return;

    const periodKey = billingPeriodKeyBaku();
    const intradayMarker = `Intraday tier ceiling ${tier} ${periodKey}`;

    const existing = await this.prisma.subscriptionInvoice.findFirst({
      where: {
        userId: ownerId,
        billingPeriod: periodKey,
        items: {
          some: {
            organizationId: orgId,
            description: { contains: intradayMarker },
          },
        },
      },
    });
    if (existing) return;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const amountAzn = Math.max(0, Math.round(spentAzn * 100) / 100);
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    const dateOnly = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    await this.prisma.subscriptionInvoice.create({
      data: {
        userId: ownerId,
        amount: new Prisma.Decimal(amountAzn),
        status: SubscriptionInvoiceStatus.ISSUED,
        date: dateOnly,
        periodStart,
        periodEnd,
        billingPeriod: periodKey,
        items: {
          create: {
            organizationId: orgId,
            description: `${intradayMarker} — ${org?.name ?? orgId} (ceiling ${ceilingAzn} AZN)`,
            amount: new Prisma.Decimal(amountAzn),
          },
        },
      },
    });
    this.logger.log(
      `Intraday tier invoice issued for org ${orgId} owner ${ownerId} (${amountAzn} AZN)`,
    );
  }

  private async resolveOwnerUserId(organizationId: string): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (org?.ownerId) return org.ownerId;
    const m = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, role: UserRole.OWNER },
      orderBy: { joinedAt: "asc" },
    });
    return m?.userId ?? null;
  }

  async bumpTierAfterIntradayPayment(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    const sub = await this.controlPlane.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { currentTier: true },
    });
    const current = sub?.currentTier ?? TariffTier.TIER_0;
    const next = nextTariffTier(current);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { billingStatus: BillingStatus.ACTIVE },
    });
    if (next) {
      await this.controlPlane.organizationSubscription.update({
        where: { organizationId: orgId },
        data: { currentTier: next },
      });
      this.logger.log(
        `Tier upgraded ${current} → ${next} for org ${orgId} after intraday payment`,
      );
    }
  }
}
