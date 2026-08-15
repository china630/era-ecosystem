import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { INDUSTRY_SATELLITE_KEYS } from "../subscription/satellite-keys.constants";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteEndpointRegistryService } from "../satellite-events/satellite-endpoint-registry.service";

const BIND_PATH = "/api/internal/v1/organization/bind";

const DEPT_NAME_HINTS: Record<string, RegExp> = {
  industry_fnb_pos: /f\s*&\s*b|fnb|food|resto|кафе|ресторан|общепит/i,
  industry_clinic: /clinic|клиник|медицин|sanator|санатор/i,
  industry_retail: /retail|pharm|аптек|магазин|retail/i,
  industry_auto_service: /auto|service|авто/i,
  industry_logistics: /logist|склад|warehouse/i,
  industry_construction: /construct|строит/i,
  industry_crm: /crm|sales|продаж/i,
  industry_wholesale: /wholesale|опт/i,
};

export type SatelliteBindSyncItem = {
  satelliteKey: string;
  baseUrl: string;
  organizationId: string;
  ok: boolean;
  status?: number;
  error?: string;
};

@Injectable()
export class SatelliteOrgBindSyncService {
  private readonly logger = new Logger(SatelliteOrgBindSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SatelliteEndpointRegistryService,
    private readonly config: ConfigService,
  ) {}

  async syncForOrg(orgId: string): Promise<{
    organizationId: string;
    results: SatelliteBindSyncItem[];
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const departments = await this.prisma.organization.findMany({
      where: { parentOrgId: orgId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    type Target = {
      satelliteKey: string;
      baseUrl: string;
      organizationId: string;
      registryOrgId: string;
    };
    const byKey = new Map<string, Target>();

    const parentEps = await this.registry.listForOrg(orgId);
    for (const ep of parentEps) {
      if (!ep.enabled) continue;
      if (!this.isIndustryKey(ep.satelliteKey)) continue;
      const resolved = await this.registry.resolveEndpoint(
        orgId,
        ep.satelliteKey,
      );
      if (!resolved?.baseUrl) continue;
      const bindOrgId = this.resolveBindOrgId(
        ep.satelliteKey,
        orgId,
        departments,
      );
      byKey.set(ep.satelliteKey, {
        satelliteKey: ep.satelliteKey,
        baseUrl: resolved.baseUrl,
        organizationId: bindOrgId,
        registryOrgId: orgId,
      });
    }

    for (const dept of departments) {
      const eps = await this.registry.listForOrg(dept.id);
      for (const ep of eps) {
        if (!ep.enabled) continue;
        if (!this.isIndustryKey(ep.satelliteKey)) continue;
        const resolved = await this.registry.resolveEndpoint(
          dept.id,
          ep.satelliteKey,
        );
        if (!resolved?.baseUrl) continue;
        // Department-owned registration wins over parent heuristic.
        byKey.set(ep.satelliteKey, {
          satelliteKey: ep.satelliteKey,
          baseUrl: resolved.baseUrl,
          organizationId: dept.id,
          registryOrgId: dept.id,
        });
      }
    }

    const token =
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ?? "";
    const results: SatelliteBindSyncItem[] = [];

    for (const target of byKey.values()) {
      results.push(await this.postBind(target, token));
    }

    return { organizationId: orgId, results };
  }

  private isIndustryKey(key: string): boolean {
    return (INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(key);
  }

  private resolveBindOrgId(
    satelliteKey: string,
    parentOrgId: string,
    departments: Array<{ id: string; name: string }>,
  ): string {
    if (satelliteKey === "industry_hotel_pms") return parentOrgId;
    const hint = DEPT_NAME_HINTS[satelliteKey];
    if (hint && departments.length > 0) {
      const match = departments.find((d) => hint.test(d.name));
      if (match) return match.id;
    }
    return parentOrgId;
  }

  private async postBind(
    target: {
      satelliteKey: string;
      baseUrl: string;
      organizationId: string;
    },
    token: string,
  ): Promise<SatelliteBindSyncItem> {
    const base = target.baseUrl.replace(/\/$/, "");
    const url = `${base}${BIND_PATH}`;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          organizationId: target.organizationId,
          boundBy: "orchestrator-sync",
        }),
        signal: AbortSignal.timeout(
          Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
        ),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.warn(
          `Bind failed ${target.satelliteKey} → ${url}: ${res.status} ${text.slice(0, 160)}`,
        );
        return {
          satelliteKey: target.satelliteKey,
          baseUrl: base,
          organizationId: target.organizationId,
          ok: false,
          status: res.status,
          error: text.slice(0, 200) || res.statusText,
        };
      }
      return {
        satelliteKey: target.satelliteKey,
        baseUrl: base,
        organizationId: target.organizationId,
        ok: true,
        status: res.status,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bind request failed";
      this.logger.warn(`Bind error ${target.satelliteKey} → ${url}: ${message}`);
      return {
        satelliteKey: target.satelliteKey,
        baseUrl: base,
        organizationId: target.organizationId,
        ok: false,
        error: message,
      };
    }
  }
}
