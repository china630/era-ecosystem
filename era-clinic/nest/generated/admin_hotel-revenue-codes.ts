import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Active hotel revenue codes for the department catalog picker. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/hotel-revenue-codes", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const hotelOrg = await getClinicHotelOrganizationId();
    if (!hotelOrg) {
      return sendJson(httpRes, { error: "Hotel organization is not linked", ...{ code: "HOTEL_NOT_LINKED" } }, 409);
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return sendJson(httpRes, { codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, status);
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
