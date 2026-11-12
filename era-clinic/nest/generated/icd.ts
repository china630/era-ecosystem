import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getTenantIcdFavorites, listIcdChapters, searchSelectableIcd } from "@/domain/icd/icd-search.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/icd", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_ICD_READ);
    if (denied) return denied;

        const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    const take = Number(url.searchParams.get("take") ?? "20");
    const favorites = await getTenantIcdFavorites();
    if (url.searchParams.get("chapters") === "1") {
      return sendJson(httpRes, { chapters: await listIcdChapters(locale) });
    }
    return sendJson(httpRes, 
      await searchSelectableIcd({
        q,
        chapter: chapter || undefined,
        locale,
        take: Number.isFinite(take) ? take : 20,
        favoriteCodes: favorites,
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
