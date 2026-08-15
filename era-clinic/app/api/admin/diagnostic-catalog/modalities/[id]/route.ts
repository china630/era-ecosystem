import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  updateModality,
  deleteModality,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  kind: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleAz: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
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
    const row = await updateModality(
      { userId: guard.session.sub, request: req },
      id,
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
    await deleteModality({ userId: guard.session.sub, request: req }, id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
