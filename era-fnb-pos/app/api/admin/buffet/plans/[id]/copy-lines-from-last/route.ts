import { NextResponse } from "next/server";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { copyLinesFromLastSameMeal } from "@/lib/buffet-planner";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const plan = await copyLinesFromLastSameMeal(id);
    return jsonOk(plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_FOUND") return jsonError("Plan not found", 404);
      if (code === "PLAN_NOT_DRAFT") return jsonError("Only draft plans can be edited", 409);
      if (code === "NO_SOURCE_PLAN") {
        return NextResponse.json(
          { error: "No earlier plan with dishes for this meal", code: "NO_SOURCE_PLAN" },
          { status: 404 },
        );
      }
    }
    return handleRouteError(err);
  }
}
