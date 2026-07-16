import { jsonOk, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { listOverdueScheduledProcedures } from "@/domain/procedure/procedure-attendance.service";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.NURSE, CLINIC_ROLE.DOCTOR]);
    if (denied) return denied;
    const rows = await listOverdueScheduledProcedures();
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
