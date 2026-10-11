import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSatelliteSession } from "@/lib/session";
import { requestOrganizationId } from "@/lib/request-organization";
import { listHotelRevenueCodes, resolveCatalogOrganizationId } from "@era/satellite-kit";

/** Hotel revenue keys for the dish picker. A department reads the hotel list. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;
    const hubOrg = await resolveCatalogOrganizationId(requestOrganizationId());
    if (!hubOrg) return jsonError("Hotel organization is not linked", 409);
    const codes = await listHotelRevenueCodes(hubOrg);
    return jsonOk({ codes });
  } catch (err) {
    return handleRouteError(err);
  }
}
