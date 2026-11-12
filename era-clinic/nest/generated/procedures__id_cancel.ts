import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { cancelProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";
import { getProcedureOrderSummary } from "@/domain/procedure/procedure-order.service";
import { cancelPaidExtraWithFolioReverse, cancelUnpaidExtra } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/procedures/:id/cancel", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const existing = await getProcedureOrderSummary(id);
    if (existing?.status === "PENDING_PAY" && existing.inPackage === false) {
      await cancelUnpaidExtra(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return sendJson(httpRes, { ok: true, status: "CANCELLED" });
    }
    if (
      existing &&
      existing.inPackage === false &&
      existing.extraTicketIssuedAt &&
      (existing.status === "SCHEDULED" || existing.status === "PROPOSED")
    ) {
      const reversed = await cancelPaidExtraWithFolioReverse(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return sendJson(httpRes, { ok: true, status: "CANCELLED", ...reversed });
    }

    const updated = await cancelProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body.reason,
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return sendJson(httpRes, updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, mapAttendanceHttpStatus(err));
    }
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, err.status);
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
