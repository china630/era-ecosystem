import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { catalogModuleKeyToPatch } from "./billing-module-toggle.helpers";
import { BillingSatelliteNotifyService } from "./billing-satellite-notify.service";
import { bakuMonthBounds, billingPeriodKeyBaku } from "./baku-billing.util";

/** Last instant of the Asia/Baku billing month (name kept for call-site stability). */
export function endOfUtcMonth(now = new Date()): Date {
  return bakuMonthBounds(billingPeriodKeyBaku(now)).to;
}

@Injectable()
export class OrganizationModuleService {
  private readonly logger = new Logger(OrganizationModuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly satelliteNotify: BillingSatelliteNotifyService,
  ) {}

  async upsertActiveInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    moduleKey: string,
    pricePerMonth: Prisma.Decimal,
  ): Promise<void> {
    await tx.organizationModule.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      create: {
        organizationId,
        moduleKey,
        priceSnapshot: pricePerMonth,
        pendingDeactivation: false,
        cancelledAt: null,
        accessUntil: null,
      },
      update: {
        priceSnapshot: pricePerMonth,
        pendingDeactivation: false,
        cancelledAt: null,
        accessUntil: null,
        activatedAt: new Date(),
      },
    });
  }

  /**
   * User disabled module: keep subscription access until end of current UTC month (TZ §14.8.6).
   * Does not remove slugs from `activeModules` — call `finalizeExpiredModuleCancellations` monthly.
   */
  async scheduleCancellationInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    moduleKey: string,
    pricePerMonth: Prisma.Decimal,
  ): Promise<void> {
    const accessUntil = endOfUtcMonth(new Date());
    await tx.organizationModule.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      create: {
        organizationId,
        moduleKey,
        priceSnapshot: pricePerMonth,
        pendingDeactivation: true,
        cancelledAt: new Date(),
        accessUntil,
      },
      update: {
        pendingDeactivation: true,
        cancelledAt: new Date(),
        accessUntil,
      },
    });
  }

  /**
   * After `accessUntil`, remove module from subscription arrays and delete row.
   */
  async finalizeExpiredModuleCancellations(now = new Date()): Promise<number> {
    const expired = await this.prisma.organizationModule.findMany({
      where: {
        cancelledAt: { not: null },
        accessUntil: { lt: now },
      },
    });
    const touchedOrgs = new Set<string>();
    let n = 0;
    for (const row of expired) {
      await this.prisma.$transaction(async (tx) => {
        await this.subscriptionAccess.updateModuleAddons(
          row.organizationId,
          catalogModuleKeyToPatch(row.moduleKey, false),
          tx,
        );
        await tx.organizationModule.delete({
          where: {
            organizationId_moduleKey: {
              organizationId: row.organizationId,
              moduleKey: row.moduleKey,
            },
          },
        });
      });
      touchedOrgs.add(row.organizationId);
      n++;
    }
    for (const orgId of touchedOrgs) {
      await this.satelliteNotify.afterModuleChange(orgId);
    }
    if (n > 0) {
      this.logger.log(
        `Finalized ${n} expired module cancellation(s) (organization_modules)`,
      );
    }
    return n;
  }

  /**
   * Post-billing cleanup: finalize modules marked for deactivation at month end.
   */
  async finalizePendingDeactivations(): Promise<number> {
    const pending = await this.prisma.organizationModule.findMany({
      where: { pendingDeactivation: true },
    });
    const touchedOrgs = new Set<string>();
    let n = 0;
    for (const row of pending) {
      await this.prisma.$transaction(async (tx) => {
        await this.subscriptionAccess.updateModuleAddons(
          row.organizationId,
          catalogModuleKeyToPatch(row.moduleKey, false),
          tx,
        );
        await tx.organizationModule.delete({
          where: {
            organizationId_moduleKey: {
              organizationId: row.organizationId,
              moduleKey: row.moduleKey,
            },
          },
        });
      });
      touchedOrgs.add(row.organizationId);
      n++;
    }
    for (const orgId of touchedOrgs) {
      await this.satelliteNotify.afterModuleChange(orgId);
    }
    if (n > 0) {
      this.logger.log(`Finalized ${n} pending module deactivation(s)`);
    }
    return n;
  }
}
