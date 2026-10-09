import { searchFinanceCatalog } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";

/**
 * Finance sku picker. Minibar stays goods-only.
 * Consumption passes includeServices=1 so a service sku with a recipe can be the norm.
 */
export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const includeServices = url.searchParams.get("includeServices") === "1";
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
    const result = await searchFinanceCatalog({
      organizationId: requestOrganizationId(),
      search: q,
      isService: includeServices ? undefined : false,
      limit,
    });
    return jsonOk({
      items: result.items.map((p) => ({
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
        sku: p.sku,
        revenueAccountCode: p.revenueAccountCode,
      })),
      source: result.source,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
