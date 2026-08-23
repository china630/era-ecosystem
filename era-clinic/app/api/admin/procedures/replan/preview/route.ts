import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { buildReplanPreview } from "@/domain/procedure/replan.service";
import { recordClinicAudit } from "@/lib/satellite-audit";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["FILL_HOLES", "PACK_RESOURCE", "APPLY_GENDER_WINDOWS", "NUCLEAR_DAY"]),
  resourceId: z.string().optional().nullable(),
  procedureTypeId: z.string().optional().nullable(),
  respectPins: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    if (body.mode === "NUCLEAR_DAY" && !isPlatformSuperAdminUser(guard.session)) {
      return jsonError("Nuclear replan requires platform super-admin", 403);
    }
    const preview = await buildReplanPreview(body, guard.session.sub);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "ProcedureReplanPreview",
      preview.previewId,
      "REPLAN_PREVIEW",
      { mode: body.mode, date: body.date },
    );
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
