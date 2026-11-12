import { NextResponse } from "next/server";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { fetchCpChannels, patchCpChannel } from "@/lib/cp-channels-client";
import { resolveOperatingMode } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/links", async (httpReq, httpRes) => {
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

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const channels = await fetchCpChannels();
    const mode = await resolveOperatingMode(requestOrganizationId()).catch(() => null);
    return sendJson(httpRes, {
      ...channels,
      operatingMode: mode,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/links", async (httpReq, httpRes) => {
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

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = (httpReq.body) as { channelId?: string; enabled?: boolean };
    if (!body.channelId || typeof body.enabled !== "boolean") {
      return sendJson(httpRes, { error: "channelId and enabled required" }, 400);
    }
    const result = await patchCpChannel(body.channelId, body.enabled);
    if (!result.ok) {
      return sendJson(httpRes, 
        { error: "Channel update failed", status: result.status }, (
        { status: result.status >= 400 ? result.status : 502 }).status ?? 200);
    }
    return sendJson(httpRes, { ok: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
