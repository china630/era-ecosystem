import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  getPhysioListItem,
  retirePhysioListItem,
  updatePhysioListItem,
} from "@/domain/physio/physio-catalog.service";

const patchSchema = z.object({
  titleAz: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    return jsonOk(await getPhysioListItem(id));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const row = await updatePhysioListItem(id, body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioListItem",
      row.id,
      "UPDATE",
      { code: row.code, active: row.active },
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const row = await retirePhysioListItem(id);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioListItem",
      row.id,
      "RETIRE",
      { code: row.code },
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
