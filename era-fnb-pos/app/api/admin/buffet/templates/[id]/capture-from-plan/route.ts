import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { captureSlotFromPlan } from "@/lib/buffet-week-template.service";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  planId: z.string().min(1),
  weekday: z.number().int().min(1).max(7),
});

export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    return jsonOk(await captureSlotFromPlan(id, body.planId, body.weekday));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "TEMPLATE_NOT_FOUND") return jsonError("Template not found", 404);
      if (code === "PLAN_NOT_FOUND") return jsonError("Plan not found on this outlet", 404);
    }
    return handleRouteError(err);
  }
}
