import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateCompatibilityRule } from "@/lib/procedure-compatibility.service";

const patchSchema = z.object({
  ruleType: z.enum(["FORBID_SAME_DAY", "MIN_HOURS_GAP", "FORBID_SEQUENCE"]).optional(),
  minHours: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
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
    return jsonOk(await updateCompatibilityRule(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}
