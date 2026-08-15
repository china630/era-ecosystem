import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { openShift } from "@/domain/cashier/cashier-shift.service";

/** Legacy open endpoint — delegates to current-shift open (idempotent). */
export async function POST() {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const shift = await openShift(session?.sub ?? null);
    return jsonOk(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
