import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import {
  cancelProcedureOrder,
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const updated = await cancelProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body.reason,
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}
