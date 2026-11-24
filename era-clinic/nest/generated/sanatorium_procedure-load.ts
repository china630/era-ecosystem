import { jsonError } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { sessionHasAnyClinicPermission } from "@/lib/auth/clinic-permission-check";
import { getProcedureLoadMatrix } from "@/domain/planning/procedure-load.service";
import {
  enterClinicStaff,
  clinicNestSession,
  runWithClinicTenant,
  runWithNestHttp,
  sendJson,
  sendRouteError,
  sendWebResponse,
} from "../bridge";

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/procedure-load", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          // Resources board + package-assign modal both call this heat API.
          if (
            !sessionHasAnyClinicPermission(session, [
              CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
              CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
            ])
          ) {
            return jsonError("Forbidden", 403, { code: "FORBIDDEN" });
          }
          const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
          const fromYmd = requestUrl.searchParams.get("from") ?? undefined;
          const toYmd = requestUrl.searchParams.get("to") ?? undefined;
          const topRaw = requestUrl.searchParams.get("top");
          const topN = topRaw ? Number(topRaw) : 10;
          const bypassCache = requestUrl.searchParams.has("bust");
          const matrix = await getProcedureLoadMatrix({
            fromYmd: fromYmd || undefined,
            toYmd: toYmd || undefined,
            topN: Number.isFinite(topN) ? topN : 10,
            bypassCache,
          });
          return sendJson(httpRes, { data: matrix });
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
