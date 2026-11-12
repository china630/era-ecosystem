import { z } from "zod";
import { createCustomerSession } from "@/lib/customer-session";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { jsonOk, setSessionCookie } from "@/lib/api-utils";
import { enterDboTenant, readDboAuthJson, resolveDboChannelTenant } from "@/lib/dbo-channel-tenant";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(["RETAIL", "CORPORATE"]),
  code: z.string().min(4).max(8),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/otp/verify", async (httpReq, httpRes) => {
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
    const auth = await engineDboJson<{
      customerJwt: string;
      customerId: string;
      globalPersonId?: string;
    }>("POST", dboPaths.authOtpVerify, body);

    const { session, cookieToken, maxAge } = await createCustomerSession({
      customerId: auth.customerId,
      globalPersonId: auth.globalPersonId,
      channel: body.channel,
      customerJwt: auth.customerJwt,
    });

    const res = jsonOk({
      customerId: session.customerId,
      channel: session.channel,
    });
    setSessionCookie(res, cookieToken, maxAge);
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
