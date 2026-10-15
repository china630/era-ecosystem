import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";
import { hotelOrganizationId } from "@/lib/pms-bridge-client";

/** Active hotel revenue codes for outlet, category, and product pickers. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    let hotelOrg = "";
    try {
      hotelOrg = await hotelOrganizationId();
    } catch {
      return jsonError("Hotel organization is not linked", 409);
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return jsonOk({ codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return jsonError(err.message, status);
    }
    return handleRouteError(err);
  }
}
