import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteConnectService } from "./satellite-connect.service";
import { TrialCatalogService } from "./trial-catalog.service";
import { SystemConfigService } from "../system-config/system-config.service";
import {
  licenseProvisionPlan,
  shiftLicenseDate,
  type DeploymentTopologyCode,
} from "./license-defaults";

function maxDate(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

@Injectable()
export class TrialSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: TrialCatalogService,
    private readonly connect: SatelliteConnectService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async patchOrgTrial(
    organizationId: string,
    input: {
      trialExpiresAt?: Date | null;
      isTrial?: boolean;
      neverExpires?: boolean;
      shiftMonths?: number;
    },
  ) {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) throw new NotFoundException("Subscription not found");

    let newDate = input.trialExpiresAt;
    let isTrial = input.isTrial;
    if (input.neverExpires === true) {
      newDate = null;
      if (isTrial === undefined) isTrial = false;
    } else if (input.shiftMonths != null && input.shiftMonths !== 0) {
      newDate = shiftLicenseDate(sub.trialExpiresAt ?? sub.expiresAt ?? null, input.shiftMonths);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationSubscription.update({
        where: { organizationId },
        data: {
          ...(newDate !== undefined
            ? { trialExpiresAt: newDate, expiresAt: newDate }
            : {}),
          ...(isTrial !== undefined ? { isTrial } : {}),
        },
      });

      if (newDate !== undefined) {
        const sats = await tx.organizationSatelliteEntitlement.findMany({
          where: { organizationId, trialOverridden: false },
        });
        for (const s of sats) {
          await tx.organizationSatelliteEntitlement.update({
            where: {
              organizationId_satelliteKey: {
                organizationId,
                satelliteKey: s.satelliteKey,
              },
            },
            data: { trialExpiresAt: newDate },
          });
        }
        const mods = await tx.organizationModule.findMany({
          where: { organizationId, trialOverridden: false },
        });
        for (const m of mods) {
          await tx.organizationModule.update({
            where: {
              organizationId_moduleKey: {
                organizationId,
                moduleKey: m.moduleKey,
              },
            },
            data: { trialExpiresAt: newDate },
          });
        }
      }
    });

    return this.getTrialTree(organizationId);
  }

  async patchDeploymentTopology(
    organizationId: string,
    topology: DeploymentTopologyCode,
    applyLicenseDefault = false,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, createdAt: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { deploymentTopology: topology },
    });

    if (applyLicenseDefault) {
      const days = await this.systemConfig.getTrialPeriodDays();
      const plan = licenseProvisionPlan(topology, org.createdAt, days);
      await this.patchOrgTrial(organizationId, {
        trialExpiresAt: plan.expiresAt,
        isTrial: plan.isTrial,
      });
    }

    return this.getTrialTree(organizationId);
  }

  async patchSatelliteTrial(
    organizationId: string,
    satelliteKey: string,
    trialExpiresAt: Date | null,
  ) {
    await this.prisma.organizationSatelliteEntitlement.upsert({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey },
      },
      create: {
        organizationId,
        satelliteKey,
        trialExpiresAt,
        trialOverridden: true,
        isTrial: true,
      },
      update: { trialExpiresAt, trialOverridden: true },
    });

    const modules = await this.catalog.getTrialAllowlistedModuleKeys(satelliteKey);
    const gate = satelliteKey.startsWith("industry_") ? satelliteKey : null;
    const keys = [...new Set([...modules, ...(gate ? [gate] : [])])];

    for (const moduleKey of keys) {
      const om = await this.prisma.organizationModule.findUnique({
        where: { organizationId_moduleKey: { organizationId, moduleKey } },
      });
      if (om && !om.trialOverridden) {
        await this.prisma.organizationModule.update({
          where: { organizationId_moduleKey: { organizationId, moduleKey } },
          data: { trialExpiresAt },
        });
      }
    }

    await this.syncSatelliteFromModules(organizationId, satelliteKey);
    await this.syncOrgFromSatellites(organizationId);
    return this.getTrialTree(organizationId);
  }

  async patchModuleTrial(
    organizationId: string,
    moduleKey: string,
    trialExpiresAt: Date | null,
  ) {
    await this.prisma.organizationModule.upsert({
      where: { organizationId_moduleKey: { organizationId, moduleKey } },
      create: {
        organizationId,
        moduleKey,
        priceSnapshot: new Prisma.Decimal(0),
        trialExpiresAt,
        trialOverridden: true,
      },
      update: { trialExpiresAt, trialOverridden: true },
    });

    const satelliteKey = await this.resolveSatelliteForModule(moduleKey);
    if (satelliteKey) {
      await this.syncSatelliteFromModules(organizationId, satelliteKey);
    }
    await this.syncOrgFromSatellites(organizationId);
    return this.getTrialTree(organizationId);
  }

  async patchQuotaOverrides(
    organizationId: string,
    quotaOverrides: Record<string, unknown> | null,
  ) {
    return this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        quotaOverrides:
          quotaOverrides == null
            ? Prisma.DbNull
            : (quotaOverrides as Prisma.InputJsonValue),
      },
    });
  }

  /** Ops preset: connect Nafta sanatorium bundle for an org. */
  async connectSanatoriumPreset(organizationId: string) {
    const keys = [
      "finance_core",
      "industry_hotel_pms",
      "industry_clinic",
      "industry_fnb_pos",
    ];
    for (const satelliteKey of keys) {
      await this.connect.connectSatellite(organizationId, satelliteKey);
    }
    return this.getTrialTree(organizationId);
  }

  async getTrialTree(organizationId: string) {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: { id: true, name: true, deploymentTopology: true },
        },
      },
    });
    if (!sub) throw new NotFoundException("Subscription not found");

    const [satellites, modules] = await Promise.all([
      this.prisma.organizationSatelliteEntitlement.findMany({
        where: { organizationId },
        include: { satellite: { select: { name: true } } },
        orderBy: { connectedAt: "asc" },
      }),
      this.prisma.organizationModule.findMany({
        where: { organizationId },
        orderBy: { moduleKey: "asc" },
      }),
    ]);

    return {
      organizationId,
      organizationName: sub.organization.name,
      org: {
        isTrial: sub.isTrial,
        trialExpiresAt: sub.trialExpiresAt?.toISOString() ?? null,
        expiresAt: sub.expiresAt?.toISOString() ?? null,
        deploymentTopology: sub.organization.deploymentTopology,
        activeModules: sub.activeModules,
        quotaOverrides: sub.quotaOverrides ?? null,
      },
      satellites: satellites.map((s) => ({
        satelliteKey: s.satelliteKey,
        name: s.satellite.name,
        trialExpiresAt: s.trialExpiresAt?.toISOString() ?? null,
        trialOverridden: s.trialOverridden,
        connectedAt: s.connectedAt.toISOString(),
        isTrial: s.isTrial,
      })),
      modules: modules.map((m) => ({
        moduleKey: m.moduleKey,
        trialExpiresAt: m.trialExpiresAt?.toISOString() ?? null,
        trialOverridden: m.trialOverridden,
        accessUntil: m.accessUntil?.toISOString() ?? null,
      })),
    };
  }

  private async resolveSatelliteForModule(moduleKey: string): Promise<string | null> {
    const pm = await this.prisma.pricingModule.findUnique({
      where: { key: moduleKey },
      select: { satelliteKey: true },
    });
    if (pm?.satelliteKey) return pm.satelliteKey;
    if (moduleKey.startsWith("industry_")) return moduleKey;
    if (moduleKey.startsWith("hotel_")) return "industry_hotel_pms";
    return null;
  }

  private async syncSatelliteFromModules(
    organizationId: string,
    satelliteKey: string,
  ) {
    const modules = await this.catalog.getTrialAllowlistedModuleKeys(satelliteKey);
    const gate = satelliteKey.startsWith("industry_") ? satelliteKey : null;
    const keys = [...new Set([...modules, ...(gate ? [gate] : [])])];
    let max: Date | null = null;
    for (const moduleKey of keys) {
      const om = await this.prisma.organizationModule.findUnique({
        where: { organizationId_moduleKey: { organizationId, moduleKey } },
      });
      max = maxDate(max, om?.trialExpiresAt ?? null);
    }
    if (max) {
      await this.prisma.organizationSatelliteEntitlement.updateMany({
        where: { organizationId, satelliteKey },
        data: { trialExpiresAt: max },
      });
    }
  }

  private async syncOrgFromSatellites(organizationId: string) {
    const sats = await this.prisma.organizationSatelliteEntitlement.findMany({
      where: { organizationId },
    });
    let max: Date | null = null;
    for (const s of sats) {
      max = maxDate(max, s.trialExpiresAt ?? null);
    }
    if (max) {
      await this.prisma.organizationSubscription.update({
        where: { organizationId },
        data: { trialExpiresAt: max, expiresAt: max },
      });
    }
  }
}
