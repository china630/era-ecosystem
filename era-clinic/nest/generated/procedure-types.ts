import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { overlayProcedureTypeNames } from "@/domain/catalog/catalog-display-name.service";
import { readUiLocale } from "@/lib/request-locale";
import { listActiveProcedureTypesRaw, listInactiveServiceDepartmentCodes } from "@/lib/services/clinic-master-data.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/procedure-types", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

    const rows = await listActiveProcedureTypesRaw();
    const locale = await readUiLocale(req);
    const named = await overlayProcedureTypeNames(rows, locale);
    const deptCodes = [
      ...new Set(named.map((row) => row.departmentCode).filter((code): code is string => Boolean(code))),
    ];
    const inactiveDepts = new Set(await listInactiveServiceDepartmentCodes(deptCodes));
    return sendJson(httpRes, 
      named.filter((row) => !row.departmentCode || !inactiveDepts.has(row.departmentCode)),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
