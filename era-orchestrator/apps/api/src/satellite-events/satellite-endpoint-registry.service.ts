import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { INDUSTRY_SATELLITE_KEYS } from "../subscription/satellite-keys.constants";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText, encryptText } from "../security/pii-crypto.util";

export const SATELLITE_KEY_CLINIC = "industry_clinic";

export type ResolvedSatelliteEndpoint = {
  baseUrl: string;
  secret: string;
};

export type SatelliteEndpointListItem = {
  satelliteKey: string;
  baseUrl: string;
  enabled: boolean;
  hasSecret: boolean;
  updatedAt: Date;
};

/** Owner launcher SoR vs local-dev compose fallback (Wave 8). */
export type LaunchUrlSource = "registry" | "env";

export type ResolvedLaunchUrl = {
  baseUrl: string;
  source: LaunchUrlSource;
  satelliteKey: string;
};

/** Docker-internal (or local) base URLs for STAFF_* fan-out when no SatelliteEndpoint row. */
const FANOUT_URL_ENV: Record<string, readonly string[]> = {
  industry_clinic: ["CLINIC_API_URL"],
  industry_hotel_pms: ["HOTEL_PMS_API_URL"],
  industry_fnb_pos: ["FNB_POS_API_URL"],
};

/**
 * Env keys for owner-launcher base URLs when no SatelliteEndpoint row exists.
 * Prefer NEXT_PUBLIC_* / ERA_*_ORIGIN (browser-reachable). CLINIC_API_URL is
 * last-resort local bridge (may be docker-internal).
 */
const LAUNCH_ENV_FALLBACKS: Record<string, readonly string[]> = {
  industry_retail: ["NEXT_PUBLIC_SATELLITE_RETAIL_URL", "ERA_RETAIL_ORIGIN"],
  industry_logistics: [
    "NEXT_PUBLIC_SATELLITE_LOGISTICS_URL",
    "ERA_LOGISTICS_ORIGIN",
  ],
  industry_construction: [
    "NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL",
    "ERA_CONSTRUCTION_ORIGIN",
  ],
  industry_crm: ["NEXT_PUBLIC_SATELLITE_CRM_URL", "ERA_CRM_ORIGIN"],
  industry_auto_service: [
    "NEXT_PUBLIC_SATELLITE_AUTO_URL",
    "ERA_AUTO_SERVICE_ORIGIN",
  ],
  industry_clinic: [
    "NEXT_PUBLIC_SATELLITE_CLINIC_URL",
    "ERA_CLINIC_ORIGIN",
    "CLINIC_API_URL",
  ],
  industry_wholesale: [
    "NEXT_PUBLIC_SATELLITE_WHOLESALE_URL",
    "ERA_WHOLESALE_ORIGIN",
  ],
  industry_hotel_pms: [
    "NEXT_PUBLIC_SATELLITE_HOTEL_URL",
    "ERA_HOTEL_PMS_ORIGIN",
  ],
  industry_fnb_pos: [
    "NEXT_PUBLIC_SATELLITE_FNB_POS_URL",
    "NEXT_PUBLIC_SATELLITE_FB_POS_URL",
    "ERA_FNB_POS_ORIGIN",
  ],
  industry_banking: ["NEXT_PUBLIC_SATELLITE_BANK_URL", "ERA_BANK_ORIGIN"],
};

@Injectable()
export class SatelliteEndpointRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolveEndpoint(
    organizationId: string,
    satelliteKey: string,
  ): Promise<ResolvedSatelliteEndpoint | null> {
    const row = await this.prisma.satelliteEndpoint.findUnique({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey },
      },
    });
    if (row?.enabled) {
      const fromRow = row.secretCipher
        ? decryptText(row.secretCipher) ?? ""
        : "";
      const secret = fromRow || this.fanoutBridgeSecret();
      return { baseUrl: row.baseUrl.replace(/\/$/, ""), secret };
    }

    return this.fanoutEnvFallback(satelliteKey);
  }

  /**
   * Owner / workspace launcher base URL: SatelliteEndpoint registry first,
   * then NEXT_PUBLIC_* / ERA_*_ORIGIN for local-dev. Does not return secrets.
   */
  async resolveLaunchBaseUrl(
    organizationId: string,
    satelliteKey: string,
  ): Promise<ResolvedLaunchUrl | null> {
    const key = satelliteKey.trim();
    if (!(INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(key)) {
      return null;
    }

    const row = await this.prisma.satelliteEndpoint.findUnique({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey: key },
      },
    });
    if (row?.enabled && row.baseUrl.trim()) {
      return {
        baseUrl: row.baseUrl.replace(/\/$/, ""),
        source: "registry",
        satelliteKey: key,
      };
    }

    const fromEnv = this.launchEnvFallback(key);
    if (!fromEnv) return null;
    return {
      baseUrl: fromEnv,
      source: "env",
      satelliteKey: key,
    };
  }

  private launchEnvFallback(satelliteKey: string): string | null {
    const keys = LAUNCH_ENV_FALLBACKS[satelliteKey] ?? [];
    for (const envKey of keys) {
      const raw =
        this.config.get<string>(envKey)?.trim() ||
        process.env[envKey]?.trim();
      if (raw) return raw.replace(/\/$/, "");
    }
    return null;
  }

  private fanoutBridgeSecret(): string {
    return (
      this.config.get<string>("SATELLITE_BRIDGE_SECRET")?.trim() ||
      this.config.get<string>("CLINIC_BRIDGE_SECRET")?.trim() ||
      ""
    );
  }

  private fanoutEnvFallback(
    satelliteKey: string,
  ): ResolvedSatelliteEndpoint | null {
    const envKeys = FANOUT_URL_ENV[satelliteKey] ?? [];
    let baseUrl: string | undefined;
    for (const envKey of envKeys) {
      const raw =
        this.config.get<string>(envKey)?.trim() || process.env[envKey]?.trim();
      if (raw) {
        baseUrl = raw.replace(/\/$/, "");
        break;
      }
    }
    if (!baseUrl) return null;
    return { baseUrl, secret: this.fanoutBridgeSecret() };
  }

  async listForOrg(organizationId: string): Promise<SatelliteEndpointListItem[]> {
    const rows = await this.prisma.satelliteEndpoint.findMany({
      where: { organizationId },
      orderBy: { satelliteKey: "asc" },
    });
    return rows.map((r) => ({
      satelliteKey: r.satelliteKey,
      baseUrl: r.baseUrl,
      enabled: r.enabled,
      hasSecret: Boolean(r.secretCipher),
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * SHARED pool SoR: org UUIDs registered on this satellite process URL.
   * baseUrl normalized (trim, no trailing slash). Case-sensitive match on stored URL.
   */
  async listOrganizationIdsByEndpoint(input: {
    satelliteKey: string;
    baseUrl: string;
  }): Promise<string[]> {
    const satelliteKey = input.satelliteKey.trim();
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    if (!satelliteKey || !baseUrl) return [];
    const rows = await this.prisma.satelliteEndpoint.findMany({
      where: { satelliteKey, baseUrl, enabled: true },
      select: { organizationId: true },
    });
    return [
      ...new Set(
        rows
          .map((r) => r.organizationId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  async upsertEndpoint(input: {
    organizationId: string;
    satelliteKey: string;
    baseUrl: string;
    secret?: string | null;
    enabled?: boolean;
  }): Promise<SatelliteEndpointListItem> {
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    const secretCipher =
      input.secret !== undefined && input.secret !== null && input.secret !== ""
        ? encryptText(input.secret)
        : undefined;

    const row = await this.prisma.satelliteEndpoint.upsert({
      where: {
        organizationId_satelliteKey: {
          organizationId: input.organizationId,
          satelliteKey: input.satelliteKey,
        },
      },
      create: {
        organizationId: input.organizationId,
        satelliteKey: input.satelliteKey,
        baseUrl,
        secretCipher: secretCipher ?? null,
        enabled: input.enabled ?? true,
      },
      update: {
        baseUrl,
        ...(secretCipher !== undefined ? { secretCipher } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });

    return {
      satelliteKey: row.satelliteKey,
      baseUrl: row.baseUrl,
      enabled: row.enabled,
      hasSecret: Boolean(row.secretCipher),
      updatedAt: row.updatedAt,
    };
  }

  async removeEndpoint(
    organizationId: string,
    satelliteKey: string,
  ): Promise<void> {
    await this.prisma.satelliteEndpoint.deleteMany({
      where: { organizationId, satelliteKey },
    });
  }
}
