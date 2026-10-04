import { listPersonIdentifiers } from "@era/satellite-kit";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM);
    if (denied) return denied;

        const globalPersonId = new URL(request.url).searchParams.get("globalPersonId")?.trim();
    if (!globalPersonId) {
      return jsonError("globalPersonId query parameter is required", 400);
    }
    const result = await listPersonIdentifiers(globalPersonId);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
