import { z } from "zod";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { enterDboTenant, readDboAuthJson, resolveDboChannelTenant } from "@/lib/dbo-channel-tenant";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/otp/request", async (httpReq, httpRes) => {
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

  
    const parsed = await readDboAuthJson(request);
    if (!parsed.ok) {
      return sendJson(httpRes, { error: parsed.error }, parsed.status);
    }
    const tenant = await resolveDboChannelTenant(request, parsed.orgNo);
    if (!tenant.ok) {
      return sendJson(httpRes, { error: tenant.error }, tenant.status);
    }
    enterDboTenant(tenant.organizationId);
    const body = schema.parse(parsed.raw);
    const data = await engineDboJson("POST", dboPaths.authOtpRequest, body);
    return sendJson(httpRes, data);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
