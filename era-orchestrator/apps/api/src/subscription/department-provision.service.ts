import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Prisma } from "@era365/database";
import { SatelliteChannelsService } from "../channels/satellite-channels.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Copies parent org trial snapshot when a department org is linked.
 * One-time fork — no live parent sync afterward.
 */
@Injectable()
export class DepartmentProvisionService {
  private readonly log = new Logger(DepartmentProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async snapshotFromParent(
    departmentOrgId: string,
    parentOrgId: string,
  ): Promise<void> {
    const [parentSub, deptSub] = await Promise.all([
      this.prisma.organizationSubscription.findUnique({
        where: { organizationId: parentOrgId },
      }),
      this.prisma.organizationSubscription.findUnique({
        where: { organizationId: departmentOrgId },
      }),
    ]);
    if (!parentSub) {
      throw new NotFoundException("Parent subscription not found");
    }

    const [parentSats, parentMods] = await Promise.all([
      this.prisma.organizationSatelliteEntitlement.findMany({
        where: { organizationId: parentOrgId },
      }),
      this.prisma.organizationModule.findMany({
        where: { organizationId: parentOrgId },
      }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      const subData = {
        currentTier: parentSub.currentTier,
        isTrial: parentSub.isTrial,
        trialExpiresAt: parentSub.trialExpiresAt,
        expiresAt: parentSub.expiresAt,
        activeModules: [...parentSub.activeModules],
        customConfig: parentSub.customConfig ?? Prisma.DbNull,
        billingPeriodKey: parentSub.billingPeriodKey,
        quotaOverrides: parentSub.quotaOverrides ?? Prisma.DbNull,
      };

      if (deptSub) {
        await tx.organizationSubscription.update({
          where: { organizationId: departmentOrgId },
          data: subData,
        });
      } else {
        await tx.organizationSubscription.create({
          data: { organizationId: departmentOrgId, ...subData },
        });
      }

      await tx.organizationSatelliteEntitlement.deleteMany({
        where: { organizationId: departmentOrgId },
      });
      for (const s of parentSats) {
        await tx.organizationSatelliteEntitlement.create({
          data: {
            organizationId: departmentOrgId,
            satelliteKey: s.satelliteKey,
            trialExpiresAt: s.trialExpiresAt,
            trialOverridden: s.trialOverridden,
            connectedAt: s.connectedAt,
            isTrial: s.isTrial,
          },
        });
      }

      await tx.organizationModule.deleteMany({
        where: { organizationId: departmentOrgId },
      });
      for (const m of parentMods) {
        await tx.organizationModule.create({
          data: {
            organizationId: departmentOrgId,
            moduleKey: m.moduleKey,
            priceSnapshot: m.priceSnapshot,
            activatedAt: m.activatedAt,
            pendingDeactivation: m.pendingDeactivation,
            cancelledAt: m.cancelledAt,
            accessUntil: m.accessUntil,
            trialExpiresAt: m.trialExpiresAt,
            trialOverridden: m.trialOverridden,
          },
        });
      }

      await tx.organization.update({
        where: { id: departmentOrgId },
        data: { activeModules: [...parentSub.activeModules] },
      });
    });

    try {
      const channels = this.moduleRef.get(SatelliteChannelsService, {
        strict: false,
      });
      if (channels) await channels.syncPlatformChannels(departmentOrgId);
    } catch (err) {
      this.log.warn(
        `Channel sync after department provision failed for ${departmentOrgId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
