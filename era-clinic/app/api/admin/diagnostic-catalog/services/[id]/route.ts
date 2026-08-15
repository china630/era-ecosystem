import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  updateService,
  deleteService,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.object({ en: z.string(), ru: z.string(), az: z.string() }),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  modalityId: z.string().min(1).optional(),
  category: z.string().optional(),
  kind: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleAz: z.string().min(1).optional(),
  serviceCode: z.string().min(1).optional(),
  fields: z.array(fieldDefSchema).nullable().optional(),
  includes: z.array(z.string()).nullable().optional(),
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
    const row = await updateService(
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
    await deleteService({ userId: guard.session.sub, request: req }, id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
