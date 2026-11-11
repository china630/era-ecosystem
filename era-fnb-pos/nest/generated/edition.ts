import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { allowedFnbPresets, fnbKitchenOn } from "@/lib/fnb-edition";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveHotelOrganizationId } from "@/lib/pms-bridge-client";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/edition", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
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
    return sendJson(httpRes, {
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
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
