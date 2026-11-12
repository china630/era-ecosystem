import { z } from "zod";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyReseatFuturePlan, previewReseatFuturePlan } from "@/domain/planning/reseat-schedule";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().min(1).optional(),
  orderIds: z.array(z.string().min(1)).optional(),
  allOpenOverlaps: z.boolean().optional(),
  allOpenClosedDays: z.boolean().optional(),
  closedDaysOnly: z.boolean().optional(),
});

/** Bulk reseat — platform super-admin only (not CLINIC_ADMIN / settings). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/admin/schedule-reseat", async (httpReq, httpRes) => {
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
    if (
      !body.allOpenOverlaps &&
      !body.allOpenClosedDays &&
      !body.closedDaysOnly &&
      !body.episodeId &&
      !(body.orderIds ?? []).length
    ) {
      return sendJson(httpRes, { error: "episodeId, orderIds, allOpenOverlaps, or allOpenClosedDays required" }, 400);
    }
    const result = body.apply ? await applyReseatFuturePlan(body) : await previewReseatFuturePlan(body);
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
