import { resolveCatalogOrganizationId } from "./operating-mode";

export type FinanceCatalogItem = {
  id: string;
  sku: string;
  name: string;
  isService: boolean;
  revenueAccountCode: string | null;
  unitPrice?: number | null;
};

function financeApiBase(): string {
  return (
    process.env.ERA_FINANCE_API_URL ??
    process.env.FINANCE_API_URL ??
    "http://127.0.0.1:4100"
  ).replace(/\/$/, "");
}

/**
 * Search the Finance product catalog for this satellite.
 * A department with revenueRouting=PARENT searches the hotel parent org.
 */
export async function searchFinanceCatalog(input: {
  organizationId: string;
  search?: string;
  isService?: boolean | null;
  limit?: number;
  /** CLINIC, FNB, RETAIL, or HOTEL. Empty returns the whole catalog. */
  channel?: "CLINIC" | "FNB" | "RETAIL" | "HOTEL";
}): Promise<{ items: FinanceCatalogItem[]; source: "finance" | "unavailable" }> {
  const catalogOrgId = await resolveCatalogOrganizationId(input.organizationId);
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 500);
  const params = new URLSearchParams({ limit: String(limit) });
  if (input.isService === true) params.set("isService", "true");
  if (input.isService === false) params.set("isService", "false");
  const search = input.search?.trim();
  if (search) params.set("search", search);
  if (input.channel) params.set("channel", input.channel);

  const token =
    process.env.FINANCE_SERVICE_TOKEN ?? process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const res = await fetch(`${financeApiBase()}/api/internal/v1/products?${params}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-organization-id": catalogOrgId,
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!res?.ok) return { items: [], source: "unavailable" };
  const data = (await res.json()) as FinanceCatalogItem[] | { items?: FinanceCatalogItem[] };
  const rows = Array.isArray(data) ? data : (data.items ?? []);
  return {
    source: "finance",
    items: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      isService: Boolean(row.isService),
      revenueAccountCode: row.revenueAccountCode ?? null,
      unitPrice: row.unitPrice ?? null,
    })),
  };
}
