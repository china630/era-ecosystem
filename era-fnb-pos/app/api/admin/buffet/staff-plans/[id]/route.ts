import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  getStaffMealPlan,
  patchStaffMealPlan,
} from "@/lib/buffet-staff-meal.service";

type Ctx = { params: Promise<{ id: string }> };

function mapCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    if ((err as { code?: string }).code === "STAFF_PLAN_NOT_FOUND") {
      return jsonError("Staff meal plan not found", 404);
    }
  }
  return null;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    return jsonOk(await getStaffMealPlan(id));
  } catch (err) {
    return mapCode(err) ?? handleRouteError(err);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    return jsonOk(await patchStaffMealPlan(id, body));
  } catch (err) {
    return mapCode(err) ?? handleRouteError(err);
  }
}
