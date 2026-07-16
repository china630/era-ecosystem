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
  markProcedureNoShow,
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
    const denied = requireClinicRole(session, [CLINIC_ROLE.NURSE, CLINIC_ROLE.DOCTOR]);
    if (denied) return denied;

    const { id } = await params;
    await schema.parseAsync(await req.json().catch(() => ({})));

    const updated = await markProcedureNoShow(id, {
      userId: session!.sub,
      canOverrideCheckIn: false,
    });
    void evaluateAndPublishCapacity().catch(() => null);
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}
