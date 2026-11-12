import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getEpisodeSchedule } from "@/lib/services/sanatorium.service";
import { bakuDateKey, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function parseDayYmd(value: string | null): string {
  if (!value?.trim()) return todayBakuYmd();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return bakuDateKey(new Date(trimmed));
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes/:id/schedule", async (httpReq, httpRes) => {
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
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const url = new URL(req.url);
    const fromYmd = parseDayYmd(url.searchParams.get("from"));
    const { start: from, end: fromEnd } = bakuDayBounds(fromYmd);
    const toParam = url.searchParams.get("to");
    const to = toParam ? bakuDayBounds(parseDayYmd(toParam)).start : fromEnd;

    const orders = await getEpisodeSchedule(
      id,
      from,
      to,
      url.searchParams.get("locale") ?? req.headers.get("x-era-locale") ?? "en",
    );
    return sendJson(httpRes, orders);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
