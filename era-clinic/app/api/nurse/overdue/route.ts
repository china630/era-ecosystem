import { jsonOk, handleRouteError, getRouteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listOverdueScheduledProcedures } from "@/domain/procedure/procedure-attendance.service";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_NURSE_OVERDUE);
    if (denied) return denied;
    const rows = await listOverdueScheduledProcedures();
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
