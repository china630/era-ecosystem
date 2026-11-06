import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  PeakRuleConflictError,
  deletePeakRule,
  updatePeakRule,
} from "@/domain/planning/peak-rules.service";

const bodySchema = z.object({
  fromYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayKind: z.enum(["WORKING", "SHORT"]),
  scope: z.enum(["OWN_ONLY", "EMPTY_DEFAULT", "CLINIC_WIDE"]),
  startHour: z.number().int().min(0).max(23).nullable().optional(),
  endHour: z.number().int().min(1).max(24).nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const row = await updatePeakRule(id, body);
    return jsonOk(row);
  } catch (err) {
    if (err instanceof PeakRuleConflictError) {
      return Response.json(
        { error: err.message, code: "PEAK_OVERLAP", conflictId: err.conflictId },
        { status: 409 },
      );
    }
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    await deletePeakRule(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
