import { hotelOrganizationId } from "@/lib/pms-bridge-client";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/edition", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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
    return sendJson(httpRes, { folioPostEnabled, settlementEnabled, hotelLinked });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
