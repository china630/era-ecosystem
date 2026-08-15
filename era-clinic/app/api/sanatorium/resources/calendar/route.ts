import { jsonOk, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { getResourceDayMatrix } from "@/domain/procedure/procedure-inventory.service";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.RECEPTION,
    ]);
    if (denied) return denied;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateParam}T00:00:00+04:00`);
    return jsonOk(await getResourceDayMatrix(date));
  } catch (err) {
    return handleRouteError(err);
  }
}
