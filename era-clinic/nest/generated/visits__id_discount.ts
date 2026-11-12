import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { applyVisitDiscountTransaction, getVisitForWrite } from "@/domain/visit/visit.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  percent: z.number().min(0).max(100),
  reason: z.string().min(3),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/visits/:id/discount", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const visit = await getVisitForWrite(id);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    if (visit.status === "COMPLETED") {
      return sendJson(httpRes, { error: "Cannot discount a completed visit" }, 400);
    }

    const currentAmount = Number(visit.amountNet);
    const discountedAmount =
      Math.round(currentAmount * (1 - body.percent / 100) * 100) / 100;

    const [updatedVisit, audit] = await applyVisitDiscountTransaction({
      visitId: id,
      discountedAmount,
      percent: body.percent,
      approvedBy: session.sub,
      reason: body.reason,
    });

    await recordClinicAudit(
      { userId: session.sub, request: req },
      "Visit",
      id,
      "DISCOUNT",
      {
        percent: body.percent,
        reason: body.reason,
        amountBefore: currentAmount,
        amountAfter: discountedAmount,
        domainAuditId: audit.id,
      },
    );

    return sendJson(httpRes, { visit: updatedVisit, audit });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
