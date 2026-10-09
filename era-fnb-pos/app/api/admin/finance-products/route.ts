import { searchFinanceCatalog } from "@era/satellite-kit";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSatelliteSession } from "@/lib/session";

/** Menu sellable SKU picker. A department reads the hotel parent catalog. */
export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
    const result = await searchFinanceCatalog({
      organizationId: requestOrganizationId(),
      search: q,
      isService: null,
      limit,
    });
    return jsonOk({
      items: result.items.map((p) => ({
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
        sku: p.sku,
        isService: p.isService,
        revenueAccountCode: p.revenueAccountCode,
      })),
      source: result.source,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
