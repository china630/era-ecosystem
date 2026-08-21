import type { FxConvertResult } from "@era/contracts";
import { resolveSatelliteOrganizationId } from "../tenancy/organization-bind-core";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";
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
  if (opts?.orchestratorUrl?.trim()) {
    return opts.orchestratorUrl.trim().replace(/\/$/, "");
  }
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4000" });
}

function serviceToken(opts?: PlatformCatalogClientOptions): string | undefined {
  return (
    opts?.serviceToken?.trim() ||
    resolveSatelliteEventServiceToken() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    undefined
  );
}

function organizationId(opts?: PlatformCatalogClientOptions): string | undefined {
  const explicit = opts?.organizationId?.trim();
  if (explicit) return explicit;
  const { organizationId: id, source } = resolveSatelliteOrganizationId({
    allowFallback: true,
  });
  return source === "fallback" ? undefined : id;
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

export type PlatformIcd10Page = {
  version: string;
  total?: number;
  items: Array<{
    code: string;
    kind: string;
    chapterCode: string;
    blockCode: string;
    parentCode: string | null;
    titleEn: string;
    titleRu: string;
    titleAz: string | null;
    searchText: string;
    selectable: boolean;
    active: boolean;
  }>;
  nextCursor?: string | null;
};

/** Industry-only: WHO ICD-10 via orchestrator gateway (not data-hub). */
export async function platformIcd10Search(
  params?: {
    q?: string;
    chapter?: string;
    take?: number;
    cursor?: string;
    selectable?: boolean;
  },
  opts?: PlatformCatalogClientOptions,
): Promise<PlatformIcd10Page | null> {
  const q = new URLSearchParams();
  if (params?.q?.trim()) q.set("q", params.q.trim());
  if (params?.chapter?.trim()) q.set("chapter", params.chapter.trim());
  if (params?.take != null) q.set("take", String(params.take));
  if (params?.cursor?.trim()) q.set("cursor", params.cursor.trim());
  if (params?.selectable === false) q.set("selectable", "0");
  const suffix = q.toString() ? `?${q}` : "";
  return platformCatalogGet<PlatformIcd10Page>(`/icd10${suffix}`, opts);
}
