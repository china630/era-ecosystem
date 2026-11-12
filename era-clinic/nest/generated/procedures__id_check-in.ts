import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { checkInProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { getClinicSettings } from "@/domain/settings/settings.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
  /** Matrix modal reception help path (tenant setting must allow it). */
  source: z.enum(["matrix"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/:id/check-in", async (httpReq, httpRes) => {
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
    if (!session) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const settings = await getClinicSettings();
    const matrixPath = body.source === "matrix";

    let canOverride = false;
    let overrideReason = body.overrideReason?.trim() || undefined;

    if (matrixPath) {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
      );
      if (denied) return denied;
      if (settings.receptionProcedureCheckIn !== true) {
        return sendJson(httpRes, { error: "Reception check-in is turned off", ...{
          code: "RECEPTION_CHECK_IN_DISABLED",
        } }, 403);
      }
      canOverride = true;
      if (!overrideReason && !body.qrToken) {
        overrideReason = "Reception matrix check-in";
      }
    } else {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      );
      if (denied) return denied;
      canOverride = sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_DOCTOR);
    }

    const updated = await checkInProcedureOrder(
      id,
      { userId: session.sub, canOverrideCheckIn: canOverride },
      {
        qrToken: body.qrToken,
        overrideReason,
      },
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
