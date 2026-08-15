import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { updateSubstitutionRule } from "@/lib/procedure-substitution.service";

const patchSchema = z.object({
  originalCode: z.string().min(1).optional(),
  substituteCode: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    return jsonOk(await updateSubstitutionRule(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}
