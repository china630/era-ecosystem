import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyReplanPreview } from "@/domain/procedure/replan.service";
import { recordClinicAudit } from "@/lib/satellite-audit";

const bodySchema = z.object({
  previewId: z.string().min(1),
  confirm: z.literal("REPLAN"),
  reason: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    const result = await applyReplanPreview({
      previewId: body.previewId,
      confirm: body.confirm,
      reason: body.reason,
      actorUserId: guard.session.sub,
      nuclearAllowed: isPlatformSuperAdminUser(guard.session),
    });
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "ProcedureReplanPreview",
      body.previewId,
      "REPLAN_APPLY",
      { reason: body.reason, snapshotId: result.snapshotId },
    );
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
