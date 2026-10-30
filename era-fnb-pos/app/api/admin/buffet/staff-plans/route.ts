import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  createStaffMealPlan,
  listStaffMealPlans,
} from "@/lib/buffet-staff-meal.service";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
    const plans = await listStaffMealPlans(outletId || undefined);
    return jsonOk({ plans });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletId: z.string().min(1),
  name: z.string().min(1).max(120),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = createSchema.parse(await request.json());
    const plan = await createStaffMealPlan(body);
    return jsonOk(plan, 201);
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
