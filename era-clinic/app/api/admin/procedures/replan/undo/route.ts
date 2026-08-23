import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { undoReplan } from "@/domain/procedure/replan.service";
import { recordClinicAudit } from "@/lib/satellite-audit";

const bodySchema = z.object({
  snapshotId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    const result = await undoReplan(body.snapshotId);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "ProcedureReplanSnapshot",
      body.snapshotId,
      "REPLAN_UNDO",
      {},
    );
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
