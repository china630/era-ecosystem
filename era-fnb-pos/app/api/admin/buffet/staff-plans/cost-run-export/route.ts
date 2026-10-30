import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { exportStaffCostRunSlice } from "@/lib/buffet-staff-meal.service";

/**
 * Preview / export staff overlap netting for Finance cost run (Wave 5).
 * Money inputs are supplied by the caller until Finance prices BOM usage.
 */
const querySchema = z.object({
  outletId: z.string().min(1),
  foodUsageAzn: z.coerce.number().min(0),
  posAttributedAzn: z.coerce.number().min(0),
  staffGrossAzn: z.coerce.number().min(0),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      foodUsageAzn: url.searchParams.get("foodUsageAzn") ?? "0",
      posAttributedAzn: url.searchParams.get("posAttributedAzn") ?? "0",
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? "0",
    });
    const slice = await exportStaffCostRunSlice(parsed);
    return jsonOk(slice);
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
