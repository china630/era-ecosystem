import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";
import { hotelOrganizationId } from "@/lib/pms-bridge-client";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Active hotel revenue codes for outlet, category, and product pickers. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/hotel-revenue-codes", async (httpReq, httpRes) => {
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

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    let hotelOrg = "";
    try {
      hotelOrg = await hotelOrganizationId();
    } catch {
      return sendJson(httpRes, { error: "Hotel organization is not linked" }, 409);
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return sendJson(httpRes, { codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return sendJson(httpRes, { error: err.message }, status);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
