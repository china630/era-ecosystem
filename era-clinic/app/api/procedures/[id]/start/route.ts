import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
  hasClinicAdminRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import {
  checkInProcedureOrder,
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";

/** Legacy alias → check-in (requires QR or override). */
const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.FLOOR,
    ]);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const canOverride =
      hasClinicAdminRole(session!) || session!.role === CLINIC_ROLE.DOCTOR;

    const updated = await checkInProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      body,
    );
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}
