import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import { getBuffetCoversRollup } from "@/lib/buffet-covers-rollup.service";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const outletId = url.searchParams.get("outletId");
    const date = url.searchParams.get("date");
    const mealRaw = url.searchParams.get("meal");
    if (!outletId || !date || !mealRaw) {
      return jsonError("outletId, date, and meal are required", 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("date must be YYYY-MM-DD", 400);
    }
    if (!(BUFFET_MEALS as readonly string[]).includes(mealRaw)) {
      return jsonError("Invalid meal", 400);
    }
    const rollup = await getBuffetCoversRollup({
      outletId,
      serviceDateYmd: date,
      meal: mealRaw as (typeof BUFFET_MEALS)[number],
    });
    return jsonOk(rollup);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
      return jsonError("Outlet not found", 404);
    }
    return handleRouteError(err);
  }
}
