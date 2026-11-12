import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { applyEpisodeBroughtInBlank } from "@/domain/lab/brought-in-result";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  serviceCode: z.string().min(1),
  resultOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.put("/api/sanatorium/episodes/:id/brought-in", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(httpReq.body);
    const result = await applyEpisodeBroughtInBlank({
      episodeId: id,
      serviceCode: body.serviceCode,
      resultOn: body.resultOn,
      cancelOpenOrdersUserId: session.sub,
    });
    if (!result.ok) {
      if (result.kind === "EPISODE_NOT_FOUND") return sendJson(httpRes, { error: "Episode not found" }, 404);
      if (result.kind === "NOT_ACCEPTED") {
        return sendJson(httpRes, { error: "This lab does not accept a brought-in blank" }, 400);
      }
      return sendJson(httpRes, { error: "Brought-in blank is outside the accepted window" }, 400);
    }
    return sendJson(httpRes, { serviceCode: result.serviceCode, resultOn: result.resultOn });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
