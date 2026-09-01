import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { requestOrganizationId } from "@/lib/request-organization";

type FinanceProductRow = {
  id: string;
  sku: string;
  name: string;
  isService?: boolean;
};

/**
 * Proxy Finance product search for SatAdmin TTK ENTITY_REF picker.
 * GET /api/admin/finance-products?q=&limit=
 */
export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const base = (
      process.env.ERA_FINANCE_API_URL ??
      process.env.FINANCE_API_URL ??
      "http://127.0.0.1:3001"
    ).replace(/\/$/, "");
    const token =
      process.env.FINANCE_SERVICE_TOKEN ??
      process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    const orgId = requestOrganizationId();

    const params = new URLSearchParams({
      isService: "false",
      limit: String(limit),
    });
    if (q) params.set("search", q);

    const res = await fetch(`${base}/api/internal/v1/products?${params}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-organization-id": orgId,
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    if (!res?.ok) {
      return jsonOk({ items: [] as FinanceProductRow[], source: "unavailable" });
    }

    const data = (await res.json()) as FinanceProductRow[] | { items?: FinanceProductRow[] };
    const items = Array.isArray(data) ? data : (data.items ?? []);
    return jsonOk({
      items: items.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
      })),
      source: "finance",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
