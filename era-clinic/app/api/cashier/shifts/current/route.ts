import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import {
  computeShiftReport,
  getCurrentShift,
  openShift,
} from "@/domain/cashier/cashier-shift.service";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const shift = await getCurrentShift();
    if (!shift) return jsonOk({ shift: null, report: null });
    const report = await computeShiftReport(shift.id);
    return jsonOk({ shift, report });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST() {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const shift = await openShift(session?.sub ?? null);
    const report = await computeShiftReport(shift.id);
    return jsonOk({ shift, report }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
