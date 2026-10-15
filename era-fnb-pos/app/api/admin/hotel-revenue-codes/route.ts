import { NextResponse } from "next/server";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSatelliteSession } from "@/lib/session";
import { requestOrganizationId } from "@/lib/request-organization";
import { HotelRevenueCatalogError, listHotelRevenueCodes, resolveCatalogOrganizationId } from "@era/satellite-kit";

/** Hotel revenue keys for the dish picker. A department reads the hotel list. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (denied) return denied;
    const hubOrg = await resolveCatalogOrganizationId(requestOrganizationId());
    if (!hubOrg) {
      return NextResponse.json(
        { error: "Hotel organization is not linked", code: "HOTEL_NOT_LINKED" },
        { status: 409 },
      );
    }
    const codes = await listHotelRevenueCodes(hubOrg);
    return jsonOk({ codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return handleRouteError(err);
  }
}
