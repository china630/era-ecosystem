import { enterRequestTenant } from "@/lib/request-organization";
import { listActiveRevenueCodeSummaries } from "@/lib/services/master-data.service";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Active hotel revenue codes for department satellites.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN. organizationId selects the tenant.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/revenue-codes", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
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
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) {
      return sendJson(httpRes, { error: "organizationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    const codes = await listActiveRevenueCodeSummaries();
    return sendJson(httpRes, { codes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revenue codes failed";
    return sendJson(httpRes, { error: message }, 500);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
