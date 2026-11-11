import { NextResponse } from "next/server";
import { fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pms/guest-entitlements", async (httpReq, httpRes) => {
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

  
    await assertHotelFnbFeature("in-house");
    const denied = denyUnlessPermission(session, PERMISSIONS.PMS_ENTITLEMENTS);
    if (denied) return denied;

    const url = new URL(request.url);
    const reservationId = url.searchParams.get("reservationId")?.trim();
    const roomNumber = url.searchParams.get("roomNumber")?.trim();
    if (!reservationId && !roomNumber) {
      return sendJson(httpRes, 
        { error: "reservationId or roomNumber required" }, 400);
    }

    const entitlements = await fetchGuestEntitlements({ reservationId, roomNumber });
    if (!entitlements) {
      return sendJson(httpRes, { found: false });
    }
    return sendJson(httpRes, entitlements);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
