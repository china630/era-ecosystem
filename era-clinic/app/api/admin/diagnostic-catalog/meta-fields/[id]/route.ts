import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateMetaField } from "@/domain/catalog/diagnostic-catalog-admin.service";

const updateSchema = z.object({
  key: z.string().min(1).optional(),
  fieldType: z.string().min(1).optional(),
  labelEn: z.string().min(1).optional(),
  labelRu: z.string().min(1).optional(),
  labelAz: z.string().min(1).optional(),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    const row = await updateMetaField(
      { userId: guard.session.sub, request: req },
      id,
      body,
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
