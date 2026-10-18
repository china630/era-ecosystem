import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getBathCalendar, saveBathCalendar } from "@/domain/planning/bath-calendar.service";

const bodySchema = z.object({
  procedureCode: z.string().min(1),
  mode: z.string().regex(/^[0-9A-Z_]{1,16}$/),
  qty: z.number().int().min(0).max(60),
  manualRestYmds: z.array(z.string()).default([]),
  manualBathYmds: z.array(z.string()).default([]),
  bathSequence: z.enum(["SITZ_THEN_FULL"]).nullable().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;
    const { id } = await ctx.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    return jsonOk(await getBathCalendar(id));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;
    const { id } = await ctx.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(await req.json());
    return jsonOk(await saveBathCalendar({ episodeId: id, ...body }));
  } catch (err) {
    return handleRouteError(err);
  }
}
