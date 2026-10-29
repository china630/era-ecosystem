import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import {
  deleteWeekTemplateSlot,
  upsertWeekTemplateSlot,
} from "@/lib/buffet-week-template.service";

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
  coversAdult: z.number().int().min(0).max(5000),
  coversChild: z.number().int().min(0).max(5000).default(0),
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
    if (code === "TEMPLATE_NOT_FOUND") return jsonError("Template not found", 404);
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
    return jsonOk(await upsertWeekTemplateSlot(id, body));
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
    // Prefer query (DELETE bodies are unreliable in browsers); JSON body still accepted.
    const fromQuery = {
      weekday: url.searchParams.get("weekday"),
      meal: url.searchParams.get("meal"),
    };
    let raw: unknown = fromQuery;
    if (fromQuery.weekday == null || fromQuery.meal == null) {
      raw = await request.json().catch(() => ({}));
    } else {
      raw = {
        weekday: Number(fromQuery.weekday),
        meal: fromQuery.meal,
      };
    }
    const body = deleteSchema.parse(raw);
    return jsonOk(await deleteWeekTemplateSlot(id, body.weekday, body.meal));
  } catch (err) {
    return mapCode(err) ?? handleRouteError(err);
  }
}
