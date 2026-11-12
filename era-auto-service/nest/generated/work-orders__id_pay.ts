import { z } from "zod";
import { fiscalizeForSatellite, isFiscalPaymentMethod, isFiscalSkipped } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { recalcWorkOrderTotals } from "@/lib/work-order-lines";
import { findWorkOrderById, markWorkOrderPaid } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "cash", "card"]),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/work-orders/:id/pay", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const method = body.paymentMethod.toUpperCase();

    const order = await findWorkOrderById(id);
    if (!order) return sendJson(httpRes, { error: "Work order not found" }, 404);
    if (order.paidAt) return sendJson(httpRes, order);

    await recalcWorkOrderTotals(id);
    const refreshed = await findWorkOrderById(id);
    if (!refreshed) return sendJson(httpRes, { error: "Work order not found" }, 404);

    const amountAzn =
      Number(refreshed.laborAmount) + Number(refreshed.partsAmount);
    if (amountAzn <= 0) {
      return sendJson(httpRes, { error: "Work order has no amount to settle" }, 400);
    }

    let fiscalNumber: string | null = null;
    if (isFiscalPaymentMethod(method)) {
      const orgId = requestOrganizationId();
      const outcome = await fiscalizeForSatellite(
        {
          documentRef: refreshed.id,
          amount: amountAzn,
          paymentMethod: method,
          registerRef: refreshed.code,
          organizationId: orgId,
          lines: [
            {
              name: `Work order ${refreshed.code}`,
              qty: 1,
              unitPrice: amountAzn,
            },
          ],
        },
        orgId,
      );
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
    }

    const paid = await markWorkOrderPaid(id, {
      paymentMethod: method,
      fiscalNumber,
    });

    return sendJson(httpRes, {
      ...paid,
      fiscalSkipped: fiscalNumber === null && isFiscalPaymentMethod(method),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
