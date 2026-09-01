import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  computeShiftReport,
  getCurrentShift,
  openShift,
} from "@/domain/cashier/cashier-shift.service";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const shift = await openShift(session?.sub ?? null);
    const report = await computeShiftReport(shift.id);
    return jsonOk({ shift, report }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
