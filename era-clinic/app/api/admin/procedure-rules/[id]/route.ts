import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { updateProcedureRule } from "@/lib/procedure-rules.service";

const patchSchema = z.object({
  kind: z.enum(["SEQUENCE_GAP", "MUTUAL_EXCLUSION"]).optional(),
  minGapMinutes: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    return jsonOk(await updateProcedureRule(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}
