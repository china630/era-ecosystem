import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  deleteGuestNight,
  listGuestNights,
  upsertGuestNight,
} from "@/lib/buffet-guest-nights.service";

const putSchema = z
  .object({
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guestNights: z.number().int().min(0),
    source: z.enum(["MANUAL", "HOTEL", "ESTIMATE"]).optional(),
    outletId: z.string().min(1).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) return jsonError("from and to are required", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return jsonError("from/to must be YYYY-MM-DD", 400);
    }
    if (from > to) return jsonError("from must be on or before to", 400);
    const entries = await listGuestNights({ fromYmd: from, toYmd: to });
    const total = entries.reduce((s, e) => s + e.guestNights, 0);
    return jsonOk({ from, to, total, entries });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = putSchema.parse(await request.json());
    const entry = await upsertGuestNight({
      serviceDateYmd: body.serviceDate,
      guestNights: body.guestNights,
      source: body.source,
      outletId: body.outletId,
      notes: body.notes,
    });
    return jsonOk({ entry });
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

export async function DELETE(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const serviceDate = url.searchParams.get("serviceDate");
    if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return jsonError("serviceDate YYYY-MM-DD required", 400);
    }
    await deleteGuestNight({ serviceDateYmd: serviceDate });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
