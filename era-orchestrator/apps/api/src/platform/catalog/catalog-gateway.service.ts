import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";
import { resolveOrganizationUuid } from "../../common/organization-id.util";
import { DataHubProxyClient } from "./data-hub-proxy.client";

const PLATFORM_REFERENCE_DATA = "platform_reference_data";

@Injectable()
export class CatalogGatewayService {
  private readonly logger = new Logger(CatalogGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly hub: DataHubProxyClient,
    private readonly entitlement: PlatformEntitlementService,
    private readonly audit: PlatformAuditService,
  ) {}

  private async assertAccess(organizationId: string): Promise<string> {
    const orgId = resolveOrganizationUuid(organizationId) ?? organizationId;
    try {
      await this.entitlement.assertPlatformModule(orgId, PLATFORM_REFERENCE_DATA);
    } catch (e) {
      if (this.config.get<string>("REFERENCE_DATA_SKIP_ENTITLEMENT") === "1") {
        this.logger.warn(`catalog entitlement skipped for org=${orgId}`);
      } else {
        throw e;
      }
    }
    return orgId;
  }

  private async proxy<T>(
    organizationId: string,
    path: string,
    action: string,
  ): Promise<T> {
    const orgId = await this.assertAccess(organizationId);
    await this.audit.log({
      organizationId: orgId,
      addonSlug: PLATFORM_REFERENCE_DATA,
      action,
      idempotencyKey: `${action}:${path.slice(0, 64)}`,
      payload: { path },
    });
    const data = await this.hub.getJson<T>(path);
    if (data === null) {
      throw new NotFoundException(`Catalog resource not found: ${path}`);
    }
    return data;
  }

  getCalendarDay(country: string, date: string, organizationId: string) {
    const q = new URLSearchParams({ date: date.slice(0, 10) });
    return this.proxy(
      organizationId,
      `/calendar/${country}/day?${q}`,
      "catalog_calendar_day",
    );
  }

  getCalendarDaysRange(
    country: string,
    from: string,
    to: string,
    organizationId: string,
  ) {
    const q = new URLSearchParams({
      from: from.slice(0, 10),
      to: to.slice(0, 10),
    });
    return this.proxy(
      organizationId,
      `/calendar/${country}/days?${q}`,
      "catalog_calendar_days",
    );
  }

  isWorkingDay(country: string, date: string, organizationId: string) {
    const q = new URLSearchParams({ date: date.slice(0, 10) });
    return this.proxy(
      organizationId,
      `/calendar/${country}/is-working-day?${q}`,
      "catalog_calendar_is_working",
    );
  }

  addBusinessDays(
    country: string,
    date: string,
    n: number,
    organizationId: string,
  ) {
    const q = new URLSearchParams({
      date: date.slice(0, 10),
      n: String(n),
    });
    return this.proxy(
      organizationId,
      `/calendar/${country}/add-business-days?${q}`,
      "catalog_calendar_add_business_days",
    );
  }

  async fxConvert(
    params: {
      from: string;
      to: string;
      amount: number;
      date?: string;
    },
    organizationId: string,
  ) {
    const q = new URLSearchParams({
      from: params.from.trim().toUpperCase(),
      to: (params.to ?? "AZN").trim().toUpperCase(),
      amount: String(params.amount),
    });
    if (params.date?.trim()) q.set("date", params.date.trim());
    const converted = await this.proxy<{
      from: string;
      to: string;
      amount: number;
      result: number;
      rateDate?: string;
      isFallback?: boolean;
    }>(organizationId, `/fx/convert?${q}`, "catalog_fx_convert");
    return {
      from: converted.from,
      to: converted.to,
      amount: converted.amount,
      result: converted.result,
      rateDate: converted.rateDate ?? params.date ?? new Date().toISOString().slice(0, 10),
      source: "era-data-hub",
      isFallback: converted.isFallback ?? false,
    };
  }

  async companyByVoen(voen: string, organizationId: string) {
    const id = voen.replace(/\D/g, "");
    if (!/^\d{10}$/.test(id)) {
      return { found: false as const, voen: id, source: "none" };
    }
    try {
      const remote = await this.proxy<{
        company?: {
          taxId: string;
          name: string;
          legalAddress?: string | null;
          legalForm?: string | null;
        };
      }>(organizationId, `/companies/${id}`, "catalog_company_voen");
      const company = remote.company;
      if (!company) {
        return { found: false as const, voen: id, source: "none" };
      }
      return {
        found: true as const,
        voen: id,
        name: company.name,
        legalAddress: company.legalAddress ?? null,
        vatStatus: false,
        source: "era-data-hub",
      };
    } catch (e) {
      if (e instanceof NotFoundException) {
        return { found: false as const, voen: id, source: "none" };
      }
      throw e;
    }
  }
}
