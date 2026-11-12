import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { settleChargeLogLocally } from "@/domain/cashier/cashier-settle.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  shiftId: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/cashier/over-quota/:id/settle", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = bodySchema.parse((httpReq.body ?? {}));
    const result = await settleChargeLogLocally({
      chargeLogId: id,
      shiftId: body.shiftId,
      payments: body.payments,
      userId: session?.sub ?? null,
    });
    return sendJson(httpRes, result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) return sendJson(httpRes, { error: err.message }, 404);
      return sendJson(httpRes, { error: err.message }, 400);
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
