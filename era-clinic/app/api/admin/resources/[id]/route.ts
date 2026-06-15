import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  updateResource,
  deleteResource,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(["ROOM", "EQUIPMENT"]).optional(),
  capacity: z.number().int().positive().optional(),
  roomId: z.string().nullable().optional(),
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
    const row = await updateResource(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "resource",
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
    await deleteResource(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "resource",
      id,
      "DELETE",
    );
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
