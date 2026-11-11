import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { checkInProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Legacy alias → check-in (requires QR or override). */
const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/:id/start", async (httpReq, httpRes) => {
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

  try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const canOverride = sessionHasClinicPermission(session!, CLINIC_PERMISSION.SCREEN_DOCTOR);

    const updated = await checkInProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      body,
    );
    return sendJson(httpRes, updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, mapAttendanceHttpStatus(err));
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
