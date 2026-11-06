import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { hotelOrganizationId } from "@/lib/pms-bridge-client";
import { requestOrganizationId } from "@/lib/request-organization";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    let folioPostEnabled = false;
    let settlementEnabled = false;
    let hotelLinked = false;
    try {
      const { checkChannelEnabledLive } = await import("@era/satellite-kit");
      const hotelOrg = await hotelOrganizationId();
      const retailOrg = requestOrganizationId();
      hotelLinked = Boolean(hotelOrg && retailOrg);
      if (hotelOrg && retailOrg) {
        const [folio, settlement] = await Promise.all([
          checkChannelEnabledLive({
            fromOrgId: retailOrg,
            fromSatelliteKey: "industry_retail",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "FOLIO_POST",
          }),
          checkChannelEnabledLive({
            fromOrgId: retailOrg,
            fromSatelliteKey: "industry_retail",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "SETTLEMENT",
          }),
        ]);
        folioPostEnabled = folio;
        settlementEnabled = settlement;
      }
    } catch {
      folioPostEnabled = false;
      settlementEnabled = false;
      hotelLinked = false;
    }
    return jsonOk({ folioPostEnabled, settlementEnabled, hotelLinked });
  } catch (err) {
    return handleRouteError(err);
  }
}
