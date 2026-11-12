import { z } from "zod";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyScheduleRecalc, previewScheduleRecalc } from "@/domain/planning/recalculate-schedule";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().optional(),
});

/** Bulk schedule moves — platform super-admin only (not CLINIC_ADMIN / settings). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/admin/schedule-recalc", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      return sendJson(httpRes, { error: "Forbidden" }, 403);
    }
    const body = bodySchema.parse(httpReq.body);
    const moves = body.apply
      ? await applyScheduleRecalc(body.episodeId)
      : await previewScheduleRecalc(body.episodeId);
    return sendJson(httpRes, { moves });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
