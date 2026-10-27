import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  BUFFET_MEALS,
  listBuffetPlans,
  upsertBuffetPlan,
} from "@/lib/buffet-planner";

const createSchema = z.object({
  outletId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(BUFFET_MEALS),
  coversAdult: z.number().int().min(0).max(5000),
  coversChild: z.number().int().min(0).max(5000).default(0),
  coversSource: z.enum(["MANUAL", "HOTEL", "MIXED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const plans = await listBuffetPlans({
      outletId: url.searchParams.get("outletId") ?? undefined,
      fromYmd: url.searchParams.get("from") ?? undefined,
      toYmd: url.searchParams.get("to") ?? undefined,
    });
    return jsonOk({ plans });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = createSchema.parse(await request.json());
    const plan = await upsertBuffetPlan({
      outletId: body.outletId,
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      coversSource: body.coversSource,
      notes: body.notes,
    });
    return jsonOk(plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "OUTLET_NOT_FOUND") {
      return jsonError("Outlet not found", 404);
    }
    return handleRouteError(err);
  }
}
