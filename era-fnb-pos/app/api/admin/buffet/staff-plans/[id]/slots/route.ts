import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import {
  deleteStaffMealSlot,
  upsertStaffMealSlot,
} from "@/lib/buffet-staff-meal.service";

type Ctx = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  menuItemId: z.string().min(1),
  station: z.string().min(1).max(40).optional(),
  plannedPortions: z.number().int().min(1).max(50000),
  wastePct: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const upsertSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  meal: z.enum(BUFFET_MEALS),
  coversStaff: z.number().int().min(0).max(5000),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(lineSchema).optional(),
});

const deleteSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  meal: z.enum(BUFFET_MEALS),
});

function mapCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "STAFF_PLAN_NOT_FOUND") return jsonError("Staff meal plan not found", 404);
    if (code === "MENU_ITEM_NOT_FOUND") return jsonError("Menu item not found on this outlet", 404);
    if (code === "INVALID_WEEKDAY" || code === "INVALID_MEAL") {
      return jsonError("Invalid weekday or meal", 400);
    }
  }
  return null;
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const body = upsertSchema.parse(await request.json());
    return jsonOk(await upsertStaffMealSlot(id, body));
  } catch (err) {
    return mapCode(err) ?? handleRouteError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const fromQuery = {
      weekday: url.searchParams.get("weekday"),
      meal: url.searchParams.get("meal"),
    };
    let raw: unknown;
    if (fromQuery.weekday != null && fromQuery.meal != null) {
      raw = { weekday: Number(fromQuery.weekday), meal: fromQuery.meal };
    } else {
      raw = await request.json().catch(() => ({}));
    }
    const body = deleteSchema.parse(raw);
    return jsonOk(await deleteStaffMealSlot(id, body.weekday, body.meal));
  } catch (err) {
    return mapCode(err) ?? handleRouteError(err);
  }
}
