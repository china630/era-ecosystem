import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { listEpisodeJournal } from "@/domain/sanatorium/episode-audit.service";
import { findEpisodeOrganizationId } from "@/domain/sanatorium/episode-resolve";
import {
  enterClinicStaff,
  clinicNestSession,
  runWithClinicTenant,
  runWithNestHttp,
  sendJson,
  sendRouteError,
  sendWebResponse,
} from "../bridge";

export function register(http: {
  get: Function;
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
}) {
  http.get("/api/sanatorium/episodes/:id/journal", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          const requestUrl = new URL(
            httpReq.originalUrl ?? httpReq.url ?? "/",
            "http://127.0.0.1",
          );
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          const denied = await requireClinicPermission(
            session,
            CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
          );
          if (denied) return denied;
          const { id } = httpReq.params;
          const episode = await findEpisodeOrganizationId(id);
          if (!episode) return sendJson(httpRes, { error: "Episode not found" }, 404);
          const scopeDenied = await assertEpisodeDataScope(session, id);
          if (scopeDenied) return scopeDenied;
          const limitRaw = requestUrl.searchParams.get("limit");
          const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 200);
          const items = await listEpisodeJournal(id, limit);
          return sendJson(httpRes, {
            items: items.map((row) => ({
              ...row,
              createdAt:
                row.createdAt instanceof Date
                  ? row.createdAt.toISOString()
                  : row.createdAt,
            })),
          });
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
