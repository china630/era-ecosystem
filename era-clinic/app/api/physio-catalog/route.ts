import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getActivePhysioCatalog } from "@/domain/physio/physio-catalog.service";

/** Ops read of active S + programs + substances (W3 type-gated fields). */
export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

        return jsonOk(await getActivePhysioCatalog());
  } catch (err) {
    return handleRouteError(err);
  }
}
