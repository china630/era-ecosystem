import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  updateProcedureType,
  deleteProcedureType,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  durationMin: z.number().int().positive().optional(),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  bodyPart: z.string().min(1).nullable().optional(),
  afterLunchAllowed: z.boolean().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    const row = await updateProcedureType(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureType",
      id,
      "UPDATE",
      body,
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    await deleteProcedureType(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureType",
      id,
      "DELETE",
    );
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
