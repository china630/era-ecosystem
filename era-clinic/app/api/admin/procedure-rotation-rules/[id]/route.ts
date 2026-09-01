import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateRotationRule } from "@/lib/procedure-rotation.service";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  memberCodes: z.array(z.string().min(1)).min(1).optional(),
  scope: z.enum(["BODY_PART", "GROUP"]).optional(),
  maxConsecutiveDays: z.number().int().min(1).max(14).optional(),
  restProcedureCode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    return jsonOk(await updateRotationRule(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}
