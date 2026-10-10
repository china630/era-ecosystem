import { jsonOk, handleRouteError, getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureDeskStaff } from "@/domain/procedure/procedure-desk-staff";

/** People who work the procedure desk (nurse board), including who matches this login. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
    if (denied) return denied;
    const staff = await listProcedureDeskStaff();
    const userId = session?.sub ?? null;
    const mine = Boolean(userId && staff.some((row) => row.userId === userId));
    return jsonOk({
      staff: staff.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        code: row.code,
        staffKind: row.staffKind,
        specialty: row.specialty,
      })),
      mine,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
