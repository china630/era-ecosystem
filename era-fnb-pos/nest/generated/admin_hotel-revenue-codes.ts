import { NextResponse } from "next/server";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { HotelRevenueCatalogError, listHotelRevenueCodes, resolveCatalogOrganizationId } from "@era/satellite-kit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Hotel revenue keys for the dish picker. A department reads the hotel list. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/hotel-revenue-codes", async (httpReq, httpRes) => {
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

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (denied) return denied;
    const hubOrg = await resolveCatalogOrganizationId(requestOrganizationId());
    if (!hubOrg) {
      return sendJson(httpRes, 
        { error: "Hotel organization is not linked", code: "HOTEL_NOT_LINKED" }, 409);
    }
    const codes = await listHotelRevenueCodes(hubOrg);
    return sendJson(httpRes, { codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return sendJson(httpRes, { error: err.message, code: err.code }, ( { status }).status ?? 200);
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
