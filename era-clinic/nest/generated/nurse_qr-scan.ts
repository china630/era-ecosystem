import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { findPatientRefByGlobalPersonId, listPatientProcedureOrdersForDay } from "@/domain/patient/patient.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  token: z.string().min(8),
  date: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/nurse/qr-scan", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_NURSE_QR_SCAN);
    if (denied) return denied;

    const body = schema.parse(httpReq.body);
    const payload = await verifyGuestQrToken(body.token.trim());
    if (!payload?.globalPersonId) {
      return sendJson(httpRes, { error: "Invalid or expired guest QR token" }, 400);
    }

    const dayYmd = body.date?.trim() || todayBakuYmd();
    const { start: day, end: next } = bakuDayBounds(dayYmd);

    const patient = await findPatientRefByGlobalPersonId(payload.globalPersonId);
    if (!patient) return sendJson(httpRes, { error: "Guest not registered in clinic" }, 404);

    const orders = await listPatientProcedureOrdersForDay({
      patientRefId: patient.id,
      dayStart: day,
      dayEnd: next,
    });

    return sendJson(httpRes, {
      globalPersonId: payload.globalPersonId,
      patientRefId: patient.id,
      patientName: patient.fullName,
      orders,
      /** Client must pass this token again on check-in (anti-fraud). */
      qrToken: body.token.trim(),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
