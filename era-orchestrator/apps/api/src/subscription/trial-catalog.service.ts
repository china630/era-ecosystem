import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  FINANCE_CORE_SATELLITE_KEY,
  resolveSatelliteGateSlug,
} from "./satellite-keys.constants";

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

  async getPlatformTrialAllowlist(): Promise<
    Array<{ key: string; name: string; satelliteKey: string | null; trialEligibleInTrial: boolean }>
  > {
    return this.prisma.pricingModule.findMany({
      orderBy: [{ satelliteKey: "asc" }, { sortOrder: "asc" }],
      select: {
        key: true,
        name: true,
        satelliteKey: true,
        trialEligibleInTrial: true,
      },
    });
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

  /** Module keys to activate when owner connects a satellite (gate + allowlisted submodules). */
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
