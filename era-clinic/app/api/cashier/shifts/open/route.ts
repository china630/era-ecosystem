import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { openShift } from "@/domain/cashier/cashier-shift.service";

/** Legacy open endpoint — delegates to current-shift open (idempotent). */
export async function POST() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const shift = await openShift(session?.sub ?? null);
    return jsonOk(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
