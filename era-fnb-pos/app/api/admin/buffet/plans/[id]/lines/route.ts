import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { upsertBuffetLine } from "@/lib/buffet-planner";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  station: z.string().min(1).max(64).default("MAIN"),
  plannedPortions: z.number().int().min(1).max(20000),
  wastePct: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id: planId } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const plan = await upsertBuffetLine({ planId, ...body });
    return jsonOk(plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_FOUND") return jsonError("Plan not found", 404);
      if (code === "PLAN_NOT_DRAFT") return jsonError("Only draft plans can be edited", 409);
      if (code === "MENU_ITEM_NOT_FOUND") return jsonError("Menu item not found on this outlet", 404);
    }
    return handleRouteError(err);
  }
}
