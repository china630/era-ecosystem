import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
      const secret = row.secretCipher ? decryptText(row.secretCipher) ?? "" : "";
      return { baseUrl: row.baseUrl.replace(/\/$/, ""), secret };
    }

    if (satelliteKey === SATELLITE_KEY_CLINIC) {
      return this.clinicEnvFallback();
    }
    return null;
  }

  private clinicEnvFallback(): ResolvedSatelliteEndpoint | null {
    const baseUrl = this.config.get<string>("CLINIC_API_URL")?.trim();
    if (!baseUrl) return null;
    return {
      baseUrl: baseUrl.replace(/\/$/, ""),
      secret: this.config.get<string>("CLINIC_BRIDGE_SECRET")?.trim() ?? "",
    };
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
