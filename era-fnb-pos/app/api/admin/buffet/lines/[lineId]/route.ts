import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { deleteBuffetLine } from "@/lib/buffet-planner";

type Ctx = { params: Promise<{ lineId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { lineId } = await ctx.params;
    const plan = await deleteBuffetLine(lineId);
    if (!plan) return jsonError("Line not found", 404);
    return jsonOk(plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_DRAFT") return jsonError("Only draft plans can be edited", 409);
    }
    return handleRouteError(err);
  }
}
