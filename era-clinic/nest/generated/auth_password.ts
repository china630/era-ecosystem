import { z } from "zod";
import { changeLocalPassword, LocalPasswordError, LOCAL_PASSWORD_MIN_LENGTH } from "@/lib/change-local-password";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(LOCAL_PASSWORD_MIN_LENGTH),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/auth/password", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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
    const body = schema.parse(httpReq.body);
    await changeLocalPassword({
      userId: session.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    if (err instanceof LocalPasswordError) {
      return sendJson(httpRes, { error: err.message }, err.status);
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
