import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FINANCE_CORE_SATELLITE_KEY,
  INDUSTRY_SATELLITE_KEYS,
} from "../subscription/satellite-keys.constants";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteEndpointRegistryService } from "../satellite-events/satellite-endpoint-registry.service";

const BIND_PATH = "/api/internal/v1/organization/bind";
const RUNTIME_CONFIG_PATH = "/api/internal/v1/runtime-config";

const DEPT_NAME_HINTS: Record<string, RegExp> = {
  industry_fnb_pos: /f\s*&\s*b|fnb|food|resto|кафе|ресторан|общепит/i,
  industry_clinic: /clinic|клиник|медицин|sanator|санатор/i,
  industry_retail: /retail|pharm|аптек|магазин|retail/i,
  industry_auto_service: /auto|service|авто/i,
  industry_logistics: /logist|склад|warehouse/i,
  industry_construction: /construct|строит/i,
  industry_crm: /crm|sales|продаж/i,
  industry_wholesale: /wholesale|опт/i,
  industry_banking: /bank|банк|cbs|dbo/i,
};

export type SatelliteBindSyncItem = {
  satelliteKey: string;
  baseUrl: string;
  organizationId: string;
  ok: boolean;
  status?: number;
  error?: string;
  runtimeConfigOk?: boolean;
  runtimeConfigError?: string;
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
      if (!this.isSyncTarget(ep.satelliteKey)) continue;
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
        if (!this.isSyncTarget(ep.satelliteKey)) continue;
        const resolved = await this.registry.resolveEndpoint(
          dept.id,
          ep.satelliteKey,
        );
        if (!resolved?.baseUrl) continue;
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
      results.push(await this.postBindAndRuntimeConfig(target, token));
    }

    return { organizationId: orgId, results };
  }

  private isIndustryKey(key: string): boolean {
    return (INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(key);
  }

  private isSyncTarget(key: string): boolean {
    return this.isIndustryKey(key) || key === FINANCE_CORE_SATELLITE_KEY;
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

  private async runtimeConfigPayload(
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    const orchPublic =
      this.config.get<string>("ERA_PUBLIC_ORCHESTRATOR_URL")?.trim() ||
      this.config.get<string>("ORCHESTRATOR_PUBLIC_URL")?.trim() ||
      "";
    const eventUrl =
      this.config.get<string>("ORCHESTRATOR_EVENT_PUBLIC_URL")?.trim() ||
      this.config.get<string>("ERA_ORCHESTRATOR_INTERNAL_URL")?.trim() ||
      orchPublic ||
      "";
    const psa =
      this.config.get<string>("PLATFORM_SUPER_ADMIN_EMAILS")?.trim() || "";
    const sso =
      this.config.get<string>("ERA_SSO_SHARED_SECRET")?.trim() || "";
    const eventToken =
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() || "";

    const body: Record<string, unknown> = {
      organizationId,
      updatedBy: "orchestrator-sync",
    };
    if (eventUrl) body.orchestratorEventUrl = eventUrl.replace(/\/$/, "");
    if (orchPublic) body.publicBaseUrl = orchPublic.replace(/\/$/, "");
    if (psa) {
      body.platformSuperAdminEmails = [
        ...new Set(
          psa
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      ];
    }
    if (sso.length >= 16) body.ssoSharedSecret = sso;
    if (eventToken) body.satelliteEventServiceToken = eventToken;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        deploymentTopology: true,
        subscriptionPlan: true,
      },
    });
    if (org?.deploymentTopology) {
      body.deploymentTopology = org.deploymentTopology;
    }

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { activeModules: true, customConfig: true, currentTier: true },
    });
    if (sub) {
      const modules = Array.isArray(sub.activeModules)
        ? sub.activeModules.filter((m): m is string => typeof m === "string")
        : [];
      body.activeModules = modules;
      const raw = sub.customConfig;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const hotelModules = (raw as Record<string, unknown>).hotelModules;
        if (hotelModules && typeof hotelModules === "object") {
          body.hotelModules = hotelModules;
        }
      }
    }

    const edition =
      org?.subscriptionPlan?.trim() ||
      (sub?.currentTier ? String(sub.currentTier) : "");
    if (edition) body.edition = edition;

    return body;
  }

  private async postBindAndRuntimeConfig(
    target: {
      satelliteKey: string;
      baseUrl: string;
      organizationId: string;
    },
    token: string,
  ): Promise<SatelliteBindSyncItem> {
    const bind = await this.postJson(
      target,
      token,
      BIND_PATH,
      {
        organizationId: target.organizationId,
        boundBy: "orchestrator-sync",
      },
      "Bind",
    );
    if (!bind.ok) return bind;

    const runtime = await this.postJson(
      target,
      token,
      RUNTIME_CONFIG_PATH,
      await this.runtimeConfigPayload(target.organizationId),
      "RuntimeConfig",
    );
    return {
      ...bind,
      runtimeConfigOk: runtime.ok,
      runtimeConfigError: runtime.error,
    };
  }

  private async postJson(
    target: {
      satelliteKey: string;
      baseUrl: string;
      organizationId: string;
    },
    token: string,
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<SatelliteBindSyncItem> {
    const base = target.baseUrl.replace(/\/$/, "");
    const url = `${base}${path}`;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(
          Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
        ),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.warn(
          `${label} failed ${target.satelliteKey} → ${url}: ${res.status} ${text.slice(0, 160)}`,
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
      const message = err instanceof Error ? err.message : `${label} request failed`;
      this.logger.warn(`${label} error ${target.satelliteKey} → ${url}: ${message}`);
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
