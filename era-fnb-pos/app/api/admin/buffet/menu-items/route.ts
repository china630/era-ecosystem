import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { menuItemsForOutlet } from "@/lib/buffet-planner";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const outletId = new URL(request.url).searchParams.get("outletId")?.trim();
    if (!outletId) return jsonError("outletId is required", 400);
    const items = await menuItemsForOutlet(outletId);
    return jsonOk({ items });
  } catch (err) {
    return handleRouteError(err);
  }
}
