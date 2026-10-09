import { searchFinanceCatalog } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";

/**
 * Proxy the hotel-parent Finance catalog for SatAdmin pickers.
 * GET /api/admin/finance-products?q=&limit=&isService=true|false
 * Omit isService to return services and goods.
 */
export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
    const isServiceRaw = url.searchParams.get("isService");
    const isService =
      isServiceRaw === "true" ? true : isServiceRaw === "false" ? false : null;

    const result = await searchFinanceCatalog({
      organizationId: guard.session.organizationId,
      search: q,
      isService,
      limit,
    });

    return jsonOk({
      items: result.items.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        isService: p.isService,
        revenueAccountCode: p.revenueAccountCode,
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
      })),
      source: result.source,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
