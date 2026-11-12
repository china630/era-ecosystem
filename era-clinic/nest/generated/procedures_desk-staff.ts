import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureDeskStaff } from "@/domain/procedure/procedure-desk-staff";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** People who work the procedure desk (nurse board), including who matches this login. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/procedures/desk-staff", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
    if (denied) return denied;
    const staff = await listProcedureDeskStaff();
    const userId = session?.sub ?? null;
    const mine = Boolean(userId && staff.some((row) => row.userId === userId));
    return sendJson(httpRes, {
      staff: staff.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        code: row.code,
        staffKind: row.staffKind,
        specialty: row.specialty,
      })),
      mine,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
