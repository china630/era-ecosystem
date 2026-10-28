import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Prisma } from "@era365/database";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import { TrialCatalogService } from "./trial-catalog.service";
import { TrialEntitlementResolver } from "./trial-entitlement.resolver";
import { isKnownSatelliteKey } from "./satellite-keys.constants";

@Injectable()
export class SatelliteConnectService {
  private readonly log = new Logger(SatelliteConnectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: TrialCatalogService,
    private readonly resolver: TrialEntitlementResolver,
    private readonly moduleRef: ModuleRef,
  ) {}

  async connectSatellite(
    organizationId: string,
    satelliteKey: string,
  ): Promise<{
    satelliteKey: string;
    activeModules: string[];
    trialExpiresAt: string | null;
    synced: boolean;
  }> {
    const key = satelliteKey.trim();
    if (!isKnownSatelliteKey(key)) {
      throw new BadRequestException(`Unknown satellite key: ${key}`);
    }

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException("Organization subscription not found");
    }

    const orgTrial = sub.trialExpiresAt ?? sub.expiresAt;
    if (orgTrial != null && orgTrial.getTime() < Date.now() && sub.isTrial) {
      throw new ForbiddenException({
        code: "TRIAL_EXPIRED",
        message: "Organization trial has expired. Renew to connect satellites.",
      });
    }

    const existing = await this.prisma.organizationSatelliteEntitlement.findUnique({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey: key },
      },
    });
    if (existing) {
      return {
        satelliteKey: key,
        activeModules: sub.activeModules,
        trialExpiresAt: existing.trialExpiresAt?.toISOString() ?? orgTrial?.toISOString() ?? null,
        synced: true,
      };
    }

    const satellite = await this.prisma.satellite.findUnique({ where: { key } });
    if (!satellite) {
      throw new BadRequestException(`Satellite catalog entry missing: ${key}`);
    }

    const moduleKeys = await this.catalog.resolveConnectModuleKeys(key);
    if (moduleKeys.length === 0) {
      throw new BadRequestException(
        "No trial-eligible modules configured for this satellite. Contact support.",
      );
    }

    const trialUntil = orgTrial ?? null;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.organizationSatelliteEntitlement.create({
        data: {
          organizationId,
          satelliteKey: key,
          trialExpiresAt: trialUntil,
          isTrial: Boolean(sub.isTrial),
          connectedAt: new Date(),
        },
      });

      const merged = [...new Set([...sub.activeModules, ...moduleKeys])];
      for (const moduleKey of moduleKeys) {
        await tx.organizationModule.upsert({
          where: {
            organizationId_moduleKey: { organizationId, moduleKey },
          },
          create: {
            organizationId,
            moduleKey,
            priceSnapshot: new Prisma.Decimal(0),
            trialExpiresAt: trialUntil,
            trialOverridden: false,
          },
          update: {
            trialExpiresAt: trialUntil,
            cancelledAt: null,
            pendingDeactivation: false,
          },
        });
      }

      const rawConfig =
        sub.customConfig != null && typeof sub.customConfig === "object"
          ? (sub.customConfig as Record<string, unknown>)
          : {};
      const customConfig = { ...rawConfig, modules: merged } as Prisma.InputJsonValue;

      await tx.organizationSubscription.update({
        where: { organizationId },
        data: { activeModules: merged, customConfig },
      });
      await tx.organization.update({
        where: { id: organizationId },
        data: { activeModules: merged },
      });

      return merged;
    });

    let synced = true;
    try {
      const bindSync = this.moduleRef.get(SatelliteOrgBindSyncService, {
        strict: false,
      });
      await bindSync.syncForOrg(organizationId);
    } catch (err) {
      synced = false;
      this.log.warn(
        `Connect satellite Sync failed for ${organizationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      satelliteKey: key,
      activeModules: result,
      trialExpiresAt: trialUntil?.toISOString() ?? null,
      synced,
    };
  }
}
