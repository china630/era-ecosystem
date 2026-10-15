import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";

/** Active hotel revenue codes for the department catalog picker. */
export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const hotelOrg = await getClinicHotelOrganizationId();
    if (!hotelOrg) {
      return jsonError("Hotel organization is not linked", 409, { code: "HOTEL_NOT_LINKED" });
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return jsonOk({ codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return jsonError(err.message, status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
