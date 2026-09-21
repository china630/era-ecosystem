import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InvoiceStatus } from "@erafinance/database";
import { billingPeriodKeyBaku } from "../billing/baku-billing.util";
import { BillingMeterService } from "../billing/billing-meter.service";
import { BillingNotificationService } from "../billing/billing-notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { CronModuleGateService } from "../subscription/cron-module-gate.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import {
  TRADE_CREDIT_DORMANT_DAYS,
  TRADE_CREDIT_INCLUDED_BUYERS,
} from "./trade-credit.constants";

const OPEN_AR_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.LOCKED_BY_SIGNATURE,
];

/**
 * Phase 0 billed-buyer snapshot (nightly EOD Asia/Baku). Soft overage only.
 */
@Injectable()
export class TradeCreditMeterService {
  private readonly logger = new Logger(TradeCreditMeterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingMeter: BillingMeterService,
    private readonly billingNotify: BillingNotificationService,
    private readonly cronGate: CronModuleGateService,
  ) {}

  /** EOD Baku — snapshot all orgs that have any trade-credit facility and SKU on. */
  @Cron("30 23 * * *", { timeZone: "Asia/Baku" })
  async runNightlySnapshots(): Promise<void> {
    const orgs = await this.prisma.tradeCreditFacility.findMany({
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    let ran = 0;
    for (const { organizationId } of orgs) {
      const on = await this.cronGate.isModuleOn(
        organizationId,
        ModuleEntitlement.TRADE_CREDIT_CONTROL,
      );
      if (!on) continue;
      try {
        await this.snapshotBilledBuyers(organizationId);
        ran += 1;
      } catch (e) {
        this.logger.warn(
          `Trade credit meter failed org=${organizationId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    if (ran > 0) {
      this.logger.log(`Trade credit buyer meter nightly: ${ran} org(s)`);
    }
  }

  /**
   * Counts distinct managed trade-credit counterparties for the Baku billing month.
   * Dedup by taxIdBlindIndex. Excludes dormant (limit 0, AR 0, no deferred in N days).
   * Soft-records overage + owner notice.
   */
  async snapshotBilledBuyers(organizationId: string): Promise<{
    periodKey: string;
    billedBuyerCount: number;
    includedQuota: number;
    overageCount: number;
  }> {
    const periodKey = billingPeriodKeyBaku();
    const includedQuota = TRADE_CREDIT_INCLUDED_BUYERS;
    const dormantSince = new Date(
      Date.now() - TRADE_CREDIT_DORMANT_DAYS * 24 * 60 * 60 * 1000,
    );

    const facilities = await this.prisma.tradeCreditFacility.findMany({
      where: { organizationId },
      select: {
        counterpartyId: true,
        creditLimit: true,
        counterparty: { select: { taxIdBlindIndex: true } },
      },
    });

    const openArInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: OPEN_AR_STATUSES },
        deletedAt: null,
      },
      select: {
        counterpartyId: true,
        totalAmount: true,
        paidAmount: true,
        counterparty: { select: { taxIdBlindIndex: true } },
      },
    });

    const recentDeferred = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        counterparty: { paymentTermsDays: { gt: 0 } },
        OR: [
          { createdAt: { gte: dormantSince } },
          { recognizedAt: { gte: dormantSince } },
        ],
      },
      select: {
        counterpartyId: true,
        counterparty: { select: { taxIdBlindIndex: true } },
      },
    });

    const limitByKey = new Map<string, number>();
    const openArByKey = new Map<string, number>();
    const recentDeferredKeys = new Set<string>();
    const cpIdByKey = new Map<string, string>();

    for (const f of facilities) {
      const key = f.counterparty.taxIdBlindIndex ?? f.counterpartyId;
      cpIdByKey.set(key, f.counterpartyId);
      limitByKey.set(key, Number(f.creditLimit));
    }

    for (const inv of openArInvoices) {
      const key = inv.counterparty.taxIdBlindIndex ?? inv.counterpartyId;
      cpIdByKey.set(key, inv.counterpartyId);
      const rem = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (rem > 0) {
        openArByKey.set(key, (openArByKey.get(key) ?? 0) + rem);
      }
    }

    for (const inv of recentDeferred) {
      const key = inv.counterparty.taxIdBlindIndex ?? inv.counterpartyId;
      cpIdByKey.set(key, inv.counterpartyId);
      recentDeferredKeys.add(key);
    }

    const candidateKeys = new Set<string>([
      ...limitByKey.keys(),
      ...openArByKey.keys(),
      ...recentDeferredKeys,
    ]);

    const keys = new Set<string>();
    for (const key of candidateKeys) {
      const limit = limitByKey.get(key) ?? 0;
      const openAr = openArByKey.get(key) ?? 0;
      const recent = recentDeferredKeys.has(key);
      // Dormant: limit 0, AR 0, no deferred shipment in N days
      if (limit <= 0 && openAr <= 0 && !recent) continue;
      keys.add(key);
    }

    const billedBuyerCount = keys.size;
    const overageCount = Math.max(0, billedBuyerCount - includedQuota);

    const existing =
      await this.prisma.tradeCreditBuyerMeterSnapshot.findUnique({
        where: {
          organizationId_periodKey: { organizationId, periodKey },
        },
        select: { overageCount: true },
      });
    const previousOverage = existing?.overageCount ?? 0;
    const overageDelta = Math.max(0, overageCount - previousOverage);

    await this.prisma.tradeCreditBuyerMeterSnapshot.upsert({
      where: {
        organizationId_periodKey: { organizationId, periodKey },
      },
      create: {
        organizationId,
        periodKey,
        billedBuyerCount,
        includedQuota,
        overageCount,
      },
      update: {
        billedBuyerCount,
        includedQuota,
        overageCount,
      },
    });

    if (overageDelta > 0) {
      await this.billingMeter.recordTradeCreditBuyerOverage(
        organizationId,
        overageDelta,
      );
    }

    if (overageCount > 0) {
      await this.billingNotify.notifyTradeCreditBuyerOverage(organizationId, {
        periodKey,
        billedBuyerCount,
        includedQuota,
        overageCount,
      });
    }

    this.logger.log(
      `Trade credit buyer meter org=${organizationId} period=${periodKey} count=${billedBuyerCount} overage=${overageCount}`,
    );

    return { periodKey, billedBuyerCount, includedQuota, overageCount };
  }
}
