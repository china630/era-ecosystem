import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";
import { listOpenEpisodesForPackageApplyRetry } from "@/domain/sanatorium/package-assign.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Super-admin: re-apply the current package version on every OPEN course that already has a program.
 * Closed courses are left alone; they pick up the current template when opened.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/sanatorium/package-apply-open", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      return sendJson(httpRes, { error: "Forbidden" }, 403);
    }

    const episodes = await listOpenEpisodesForPackageApplyRetry();

    let updated = 0;
    const failed: Array<{ id: string; name: string }> = [];
    for (const episode of episodes) {
      try {
        await applyPackageAutoBlocks(episode.id, { trigger: "MANUAL_RETRY" });
        updated += 1;
      } catch {
        failed.push({
          id: episode.id,
          name: episode.patientRef?.fullName?.trim() || episode.id,
        });
      }
    }
    return sendJson(httpRes, { updated, failed });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
