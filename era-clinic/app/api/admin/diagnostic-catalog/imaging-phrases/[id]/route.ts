import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  deleteImagingPhrase,
  updateImagingPhrase,
} from "@/domain/catalog/imaging-phrase.service";

const updateSchema = z.object({
  organKey: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  textEn: z.string().min(1).optional(),
  textRu: z.string().min(1).optional(),
  textAz: z.string().min(1).optional(),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
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
    return jsonOk(await updateImagingPhrase(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(_req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    await deleteImagingPhrase(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
