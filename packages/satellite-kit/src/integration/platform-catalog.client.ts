/**
 * Orchestrator Platform Catalog Gateway — industry sync reads (calendar, FX, VÖEN).
 */

import type { FxConvertResult } from "@era/contracts";
import type {
  FinanceFxPreviewResult,
  FinanceVoenLookupResult,
} from "./finance-handoffs.client";

export type PlatformCatalogClientOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
  organizationId?: string;
  enabled?: boolean;
};

function catalogEnabled(opts?: PlatformCatalogClientOptions): boolean {
  if (opts?.enabled === false) return false;
  const flag = process.env.ERA_PLATFORM_CATALOG_VIA_ORCH;
  if (flag != null && flag.toLowerCase() === "false") return false;
  return true;
}

function baseUrl(opts?: PlatformCatalogClientOptions): string {
  return (
    opts?.orchestratorUrl ??
    process.env.ORCHESTRATOR_URL ??
    process.env.CONTROL_PLANE_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
}

function serviceToken(opts?: PlatformCatalogClientOptions): string | undefined {
  return (
    opts?.serviceToken ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
    process.env.MDM_INTERNAL_SERVICE_TOKEN
  )?.trim();
}

function organizationId(opts?: PlatformCatalogClientOptions): string | undefined {
  return (
    opts?.organizationId ??
    process.env.ERA_SATELLITE_ORGANIZATION_ID ??
    process.env.ERA_CLINIC_ORGANIZATION_ID ??
    process.env.ERA_HOTEL_ORGANIZATION_ID
  )?.trim();
}

function authHeaders(
  token: string,
  orgId: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "x-service-token": token,
    "X-Organization-Id": orgId,
  };
}

/** Low-level GET to platform catalog gateway. Returns null when unavailable. */
export async function platformCatalogGet<T>(
  catalogPath: string,
  opts?: PlatformCatalogClientOptions,
): Promise<T | null> {
  if (!catalogEnabled(opts)) return null;
  const token = serviceToken(opts);
  const orgId = organizationId(opts);
  if (!token || !orgId) return null;
  const path = catalogPath.startsWith("/") ? catalogPath : `/${catalogPath}`;
  const url = `${baseUrl(opts)}/platform/v1/catalog${path}`;
  try {
    const res = await fetch(url, {
      headers: authHeaders(token, orgId),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function platformFxConvert(
  params: { from: string; to?: string; amount: number; date?: string },
  opts?: PlatformCatalogClientOptions,
): Promise<FinanceFxPreviewResult | null> {
  const q = new URLSearchParams({
    from: params.from.trim().toUpperCase(),
    amount: String(params.amount),
    to: (params.to ?? "AZN").trim().toUpperCase(),
  });
  if (params.date?.trim()) q.set("date", params.date.trim());
  const body = await platformCatalogGet<FxConvertResult & FinanceFxPreviewResult>(
    `/fx/convert?${q}`,
    opts,
  );
  if (!body || typeof body.result !== "number") return null;
  return {
    from: body.from,
    to: body.to,
    amount: body.amount,
    result: body.result,
    rateDate: body.rateDate ?? params.date ?? new Date().toISOString().slice(0, 10),
    source: body.source ?? "era-orchestrator-catalog",
    isFallback: body.isFallback ?? false,
  };
}

export async function platformVoenLookup(
  voen: string,
  opts?: PlatformCatalogClientOptions,
): Promise<FinanceVoenLookupResult> {
  const id = voen.replace(/\D/g, "");
  const body = await platformCatalogGet<FinanceVoenLookupResult>(
    `/companies/${encodeURIComponent(id)}`,
    opts,
  );
  if (!body) {
    return { found: false, voen: id, source: "none" };
  }
  return {
    found: Boolean(body.found),
    voen: body.voen ?? id,
    name: body.name ?? null,
    legalAddress: body.legalAddress ?? null,
    vatStatus: body.vatStatus,
    source: body.source ?? "era-data-hub",
  };
}
