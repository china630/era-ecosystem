import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateDiagnosticCategory } from "@/domain/catalog/diagnostic-catalog-admin.service";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
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
    const body = patchSchema.parse(await req.json());
    const row = await updateDiagnosticCategory(
      { userId: guard.session.sub, request: req },
      id,
      body,
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
