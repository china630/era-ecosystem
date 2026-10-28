import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { copyBuffetPlan } from "@/lib/buffet-planner";

const bodySchema = z.object({
  serviceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const body = bodySchema.parse(raw ?? {});
    const plan = await copyBuffetPlan(id, body.serviceDate);
    return jsonOk(plan, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_FOUND") return jsonError("Plan not found", 404);
      if (code === "PLAN_SLOT_TAKEN") {
        return NextResponse.json(
          { error: "A plan already exists for that outlet, date, and meal", code: "PLAN_SLOT_TAKEN" },
          { status: 409 },
        );
      }
    }
    return handleRouteError(err);
  }
}
