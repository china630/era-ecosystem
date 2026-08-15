import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  FINANCE_CORE_SATELLITE_KEY,
  resolveSatelliteGateSlug,
} from "./satellite-keys.constants";

export type TrialAllowlistGroup = {
  groupKey: string;
  groupName: string;
  modules: Array<{
    key: string;
    name: string;
    satelliteKey: string | null;
    trialEligibleInTrial: boolean;
  }>;
};

@Injectable()
export class TrialCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listConnectableSatellites(): Promise<
    Array<{ key: string; name: string; verticalSlug: string }>
  > {
    return this.prisma.satellite.findMany({
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true, verticalSlug: true },
    });
  }

  async getTrialAllowlistedModuleKeys(satelliteKey: string): Promise<string[]> {
    const rows = await this.prisma.pricingModule.findMany({
      where: { satelliteKey, trialEligibleInTrial: true },
      select: { key: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => r.key);
  }

  async getPlatformTrialAllowlist(): Promise<TrialAllowlistGroup[]> {
    const [satellites, modules] = await Promise.all([
      this.listConnectableSatellites(),
      this.prisma.pricingModule.findMany({
        orderBy: [{ satelliteKey: "asc" }, { sortOrder: "asc" }],
        select: {
          key: true,
          name: true,
          satelliteKey: true,
          trialEligibleInTrial: true,
          catalogKind: true,
        },
      }),
    ]);

    const groupMap = new Map<string, TrialAllowlistGroup>();

    const ensureGroup = (key: string, name: string) => {
      let g = groupMap.get(key);
      if (!g) {
        g = { groupKey: key, groupName: name, modules: [] };
        groupMap.set(key, g);
      }
      return g;
    };

    ensureGroup(FINANCE_CORE_SATELLITE_KEY, "Finance Core");
    for (const s of satellites) {
      ensureGroup(s.key, s.name);
    }
    ensureGroup("platform", "Platform / add-ons");

    for (const m of modules) {
      let groupKey: string;
      if (m.catalogKind === "ADDON" || m.key.startsWith("platform_")) {
        groupKey = "platform";
      } else if (m.catalogKind === "SATELLITE") {
        groupKey = m.key;
      } else {
        groupKey = m.satelliteKey ?? FINANCE_CORE_SATELLITE_KEY;
      }
      const sat = satellites.find((s) => s.key === groupKey);
      const group = ensureGroup(
        groupKey,
        sat?.name ??
          (groupKey === FINANCE_CORE_SATELLITE_KEY
            ? "Finance Core"
            : groupKey === "platform"
              ? "Platform / add-ons"
              : groupKey),
      );
      group.modules.push({
        key: m.key,
        name: m.name,
        satelliteKey: m.satelliteKey,
        trialEligibleInTrial: m.trialEligibleInTrial,
      });
    }

    const order = [
      FINANCE_CORE_SATELLITE_KEY,
      ...satellites.map((s) => s.key),
      "platform",
    ];
    const seen = new Set(order);
    for (const key of groupMap.keys()) {
      if (!seen.has(key)) order.push(key);
    }
    return order
      .map((k) => groupMap.get(k))
      .filter((g): g is TrialAllowlistGroup => g != null);
  }

  async patchPlatformTrialAllowlist(
    moduleKeys: string[],
  ): Promise<{ updated: number }> {
    const keys = [...new Set(moduleKeys.map((k) => k.trim()).filter(Boolean))];
    await this.prisma.$transaction(async (tx) => {
      await tx.pricingModule.updateMany({
        data: { trialEligibleInTrial: false },
      });
      if (keys.length > 0) {
        await tx.pricingModule.updateMany({
          where: { key: { in: keys } },
          data: { trialEligibleInTrial: true },
        });
      }
    });
    return { updated: keys.length };
  }

  /** Module keys to activate when owner connects a satellite (gate + allowlisted modules). */
  async resolveConnectModuleKeys(satelliteKey: string): Promise<string[]> {
    const allowlisted = await this.getTrialAllowlistedModuleKeys(satelliteKey);
    const gate = resolveSatelliteGateSlug(satelliteKey);
    const out = new Set<string>(allowlisted);
    if (gate) out.add(gate);
    if (satelliteKey === FINANCE_CORE_SATELLITE_KEY && out.size === 0) {
      out.add("nas");
    }
    return [...out];
  }
}
