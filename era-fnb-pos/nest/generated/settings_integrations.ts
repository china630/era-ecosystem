import { NextResponse } from "next/server";
import { z } from "zod";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbIntegrationSettings, upsertFnbIntegrationSettings } from "@/lib/fnb-integration-settings";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  financeWebUrl: z.string().max(500).optional(),
  hotelPmsUrl: z.string().max(500).optional(),
  orchestratorBaseUrl: z.string().max(500).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/settings/integrations", async (httpReq, httpRes) => {
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

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    // Read: Settings, Menu (recipes deep-link), or Buffet (Open Finance).
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.ADMIN_INTEGRATION,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_MENU,
      PERMISSIONS.SCREEN_ADMIN_BUFFET,
    ]);
    if (denied) return denied;
    const settings = await getFnbIntegrationSettings(session.organizationId);
    return sendJson(httpRes, { settings });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/settings/integrations", async (httpReq, httpRes) => {
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

  
    if (!session?.organizationId) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_INTEGRATION);
    if (denied) return denied;
    const body = patchSchema.parse(httpReq.body);
    const settings = await upsertFnbIntegrationSettings(body, session.organizationId);
    return sendJson(httpRes, { settings });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
