import { handleRouteError, jsonOk, jsonError } from "@/lib/api-utils";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { allowedFnbPresets, fnbKitchenOn } from "@/lib/fnb-edition";
import { getSatelliteSession } from "@/lib/session";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveHotelOrganizationId } from "@/lib/pms-bridge-client";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const profile = await getFnbOrgProfile();
    let folioPostEnabled = false;
    let settlementEnabled = false;
    try {
      const { checkChannelEnabledLive } = await import("@era/satellite-kit");
      const hotelOrg = await resolveHotelOrganizationId();
      const fnbOrg = requestOrganizationId();
      if (hotelOrg && fnbOrg) {
        const [folio, settlement] = await Promise.all([
          checkChannelEnabledLive({
            fromOrgId: fnbOrg,
            fromSatelliteKey: "industry_fnb_pos",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "FOLIO_POST",
          }),
          checkChannelEnabledLive({
            fromOrgId: fnbOrg,
            fromSatelliteKey: "industry_fnb_pos",
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
    }
    return jsonOk({
      edition: profile.edition,
      hotelMode: profile.hotelMode,
      enabledPresets: profile.enabledPresets,
      allowedPresets: allowedFnbPresets(profile.edition),
      kitchen: fnbKitchenOn(profile),
      waiterPinPacks: profile.waiterPinPacks,
      activeModules: profile.activeModules,
      folioPostEnabled,
      settlementEnabled,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
