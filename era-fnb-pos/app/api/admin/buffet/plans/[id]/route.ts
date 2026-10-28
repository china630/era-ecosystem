import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  BUFFET_STATUSES,
  getBuffetPlan,
  setBuffetPlanStatus,
  updateBuffetPlan,
  BUFFET_MEALS,
} from "@/lib/buffet-planner";

const patchSchema = z.object({
  serviceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meal: z.enum(BUFFET_MEALS).optional(),
  coversAdult: z.number().int().min(0).max(5000).optional(),
  coversChild: z.number().int().min(0).max(5000).optional(),
  coversSource: z.enum(["MANUAL", "HOTEL", "MIXED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(BUFFET_STATUSES).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const plan = await getBuffetPlan(id);
    if (!plan) return jsonError("Plan not found", 404);
    return jsonOk(plan);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const existing = await getBuffetPlan(id);
    if (!existing) return jsonError("Plan not found", 404);
    const body = patchSchema.parse(await request.json());
    if (body.status) {
      const plan = await setBuffetPlanStatus(id, body.status);
      return jsonOk(plan);
    }
    const plan = await updateBuffetPlan(id, {
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      coversSource: body.coversSource,
      notes: body.notes,
    });
    if (!plan) return jsonError("Plan not found", 404);
    return jsonOk(plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_CLOSED") return jsonError("Plan is closed", 409);
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
