import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listAvailableResourceSlots } from "@/domain/procedure/procedure-inventory.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/resources/available-slots", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_RESOURCES);
    if (denied) return denied;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") ?? todayBakuYmd();
    const resourceId = url.searchParams.get("resourceId") ?? undefined;
    const procedureCode = url.searchParams.get("procedureCode") ?? undefined;
    const patientRefId = url.searchParams.get("patientRefId") ?? undefined;
    const excludeOrderId = url.searchParams.get("excludeOrderId") ?? undefined;

    const { clinicDayIsClosed } = await import("@/domain/planning/slot-decision");
    if (await clinicDayIsClosed(dateParam)) {
      return sendJson(httpRes, { date: dateParam, closed: true, slots: [] });
    }
    const slots = await listAvailableResourceSlots({
      date: bakuDayBounds(dateParam).start,
      resourceId,
      procedureCode,
      patientRefId,
      excludeOrderId,
    });
    return sendJson(httpRes, { date: dateParam, closed: false, slots });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
