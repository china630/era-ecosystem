import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  FINANCE_CORE_SATELLITE_KEY,
  INDUSTRY_SATELLITE_KEYS,
} from "./satellite-keys.constants";

const FINANCE_MODULE_PREFIXES = [
  "nas",
  "ifrs",
  "production",
  "manufacturing",
  "fixed_assets",
  "inventory",
  "hr_full",
  "audit_hub",
  "cash_bank",
  "kassa",
  "banking",
  "tax_pro",
  "trade_pro",
  "compliance_pro",
  "contract_management",
  "gov_budget",
  "recovery_pro",
];

@Injectable()
export class TrialEntitlementResolver {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgTrialExpiresAt(organizationId: string): Promise<Date | null> {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { trialExpiresAt: true, expiresAt: true, isTrial: true },
    });
    if (!sub) return null;
    return sub.trialExpiresAt ?? sub.expiresAt ?? null;
  }

  async resolveSatelliteKeyForModule(moduleKey: string): Promise<string | null> {
    const pm = await this.prisma.pricingModule.findUnique({
      where: { key: moduleKey },
      select: { satelliteKey: true, catalogKind: true },
    });
    if (pm?.satelliteKey) return pm.satelliteKey;
    if (moduleKey.startsWith("industry_")) return moduleKey;
    if (moduleKey.startsWith("hotel_")) return "industry_hotel_pms";
    if (FINANCE_MODULE_PREFIXES.some((p) => moduleKey.startsWith(p) || moduleKey === p)) {
      return FINANCE_CORE_SATELLITE_KEY;
    }
    return null;
  }

  async effectiveUntil(
    organizationId: string,
    moduleKey: string,
  ): Promise<Date | null> {
    const om = await this.prisma.organizationModule.findUnique({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey },
      },
      select: { trialExpiresAt: true },
    });
    if (om?.trialExpiresAt) return om.trialExpiresAt;

    const satelliteKey = await this.resolveSatelliteKeyForModule(moduleKey);
    if (satelliteKey) {
      const sat = await this.prisma.organizationSatelliteEntitlement.findUnique({
        where: {
          organizationId_satelliteKey: { organizationId, satelliteKey },
        },
        select: { trialExpiresAt: true },
      });
      if (sat?.trialExpiresAt) return sat.trialExpiresAt;
    }

    return this.getOrgTrialExpiresAt(organizationId);
  }

  async isSatelliteConnected(
    organizationId: string,
    satelliteKey: string,
  ): Promise<boolean> {
    const row = await this.prisma.organizationSatelliteEntitlement.findUnique({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey },
      },
    });
    return Boolean(row);
  }

  async listSatelliteEntitlements(organizationId: string) {
    return this.prisma.organizationSatelliteEntitlement.findMany({
      where: { organizationId },
      orderBy: { connectedAt: "asc" },
    });
  }

  async listModuleTrials(organizationId: string) {
    return this.prisma.organizationModule.findMany({
      where: { organizationId, trialExpiresAt: { not: null } },
      select: {
        moduleKey: true,
        trialExpiresAt: true,
        trialOverridden: true,
        accessUntil: true,
      },
    });
  }

  async listConnectableSatelliteKeys(organizationId: string): Promise<string[]> {
    const connected = await this.prisma.organizationSatelliteEntitlement.findMany({
      where: { organizationId },
      select: { satelliteKey: true },
    });
    const connectedSet = new Set(connected.map((c) => c.satelliteKey));
    const all = await this.prisma.satellite.findMany({
      select: { key: true },
      orderBy: { sortOrder: "asc" },
    });
    return all.map((s) => s.key).filter((k) => !connectedSet.has(k));
  }

  async isModuleTrialAllowlisted(moduleKey: string): Promise<boolean> {
    const pm = await this.prisma.pricingModule.findUnique({
      where: { key: moduleKey },
      select: { trialEligibleInTrial: true, catalogKind: true, key: true },
    });
    if (!pm) {
      return (
        moduleKey.startsWith("industry_") &&
        (INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(moduleKey)
      );
    }
    if (pm.catalogKind === "SATELLITE") return true;
    return pm.trialEligibleInTrial;
  }

  async hasModuleEntitlement(
    organizationId: string,
    moduleKey: string,
  ): Promise<{ entitled: boolean; effectiveUntil: Date | null; reason?: string }> {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) return { entitled: false, effectiveUntil: null, reason: "no_subscription" };
    if (sub.isBlocked) {
      return { entitled: false, effectiveUntil: null, reason: "blocked" };
    }

    const satelliteKey = await this.resolveSatelliteKeyForModule(moduleKey);
    if (satelliteKey) {
      const connected = await this.isSatelliteConnected(organizationId, satelliteKey);
      if (!connected) {
        return { entitled: false, effectiveUntil: null, reason: "satellite_not_connected" };
      }
    }

    const allowlisted = await this.isModuleTrialAllowlisted(moduleKey);
    if (sub.isTrial && !allowlisted) {
      const inActive = sub.activeModules.includes(moduleKey);
      if (!inActive) {
        return { entitled: false, effectiveUntil: null, reason: "not_in_allowlist" };
      }
    }

    const until = await this.effectiveUntil(organizationId, moduleKey);
    if (until != null && until.getTime() < Date.now()) {
      return { entitled: false, effectiveUntil: until, reason: "expired" };
    }

    const activeModules = sub.activeModules ?? [];
    if (!activeModules.includes(moduleKey)) {
      const gate = satelliteKey && moduleKey === satelliteKey;
      if (!gate && !activeModules.some((m) => m === moduleKey)) {
        return { entitled: false, effectiveUntil: until, reason: "not_active" };
      }
    }

    return { entitled: true, effectiveUntil: until };
  }
}
