import { jsonOk, handleRouteError, getRouteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listAvailableResourceSlots } from "@/domain/procedure/procedure-inventory.service";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_RESOURCES);
    if (denied) return denied;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const resourceId = url.searchParams.get("resourceId") ?? undefined;
    const procedureCode = url.searchParams.get("procedureCode") ?? undefined;
    const patientRefId = url.searchParams.get("patientRefId") ?? undefined;
    const excludeOrderId = url.searchParams.get("excludeOrderId") ?? undefined;

    const slots = await listAvailableResourceSlots({
      date: new Date(`${dateParam}T00:00:00`),
      resourceId,
      procedureCode,
      patientRefId,
      excludeOrderId,
    });
    return jsonOk({ date: dateParam, slots });
  } catch (err) {
    return handleRouteError(err);
  }
}
