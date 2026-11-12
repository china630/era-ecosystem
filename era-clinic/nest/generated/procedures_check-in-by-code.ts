import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { checkInProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { findScheduledProcedureByAccessCode } from "@/domain/procedure/procedure-order.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_RE = new RegExp(`^[${ACCESS_CODE_ALPHABET}]{5}$`);

const schema = z.object({
  code: z
    .string()
    .trim()
    .length(5)
    .refine((v) => ACCESS_CODE_RE.test(v.toUpperCase()), {
      message: "Invalid access code format",
    }),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/check-in-by-code", async (httpReq, httpRes) => {
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

    const { code } = schema.parse(httpReq.body);
    const normalized = code.toUpperCase();
    const organizationId = requestOrganizationId();

    const order = await findScheduledProcedureByAccessCode(organizationId, normalized);
    if (!order) {
      return sendJson(httpRes, { error: "Procedure not found" }, 404);
    }

    const canOverride = sessionHasClinicPermission(session!, CLINIC_PERMISSION.SCREEN_DOCTOR);

    const updated = await checkInProcedureOrder(
      order.id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      { accessCode: normalized },
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
