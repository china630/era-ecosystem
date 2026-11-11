import { SATELLITE_WHOLESALE_ORDER_CONFIRMED } from "@era/contracts";
import { fiscalizeForSatellite, isFiscalPaymentMethod, isFiscalSkipped } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { findB2BOrderById, settleCounterOrderPaid } from "@/lib/b2b-order.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "cash", "card"]),
});

/** Cash-and-carry / retail counter settlement for walk-in buyers (channel=COUNTER). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/orders/:id/pay", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

    const order = await findB2BOrderById(id);
    if (!order) return sendJson(httpRes, { error: "Order not found" }, 404);
    if (order.channel !== "COUNTER") {
      return sendJson(httpRes, { error: "Fiscal pay is only for counter (walk-in) orders" }, 400);
    }
    if (order.paidAt) return sendJson(httpRes, order);

    const amountNet = Number(order.amountNet);
    if (amountNet <= 0) {
      return sendJson(httpRes, { error: "Order has no amount to settle" }, 400);
    }

    let fiscalNumber: string | null = null;
    if (isFiscalPaymentMethod(method)) {
      const orgId = requestOrganizationId();
      const outcome = await fiscalizeForSatellite(
        {
          documentRef: order.id,
          amount: amountNet,
          paymentMethod: method,
          outletCode: "COUNTER",
          organizationId: orgId,
          lines: [
            {
              name: `Counter order ${order.id.slice(0, 8)}`,
              qty: 1,
              unitPrice: amountNet,
            },
          ],
        },
        orgId,
      );
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
    }

    const paid = await settleCounterOrderPaid(id, method, fiscalNumber);

    await dispatchSatelliteEvent({
      type: SATELLITE_WHOLESALE_ORDER_CONFIRMED,
      payload: {
        orderId: paid.id,
        buyerCounterpartyId: paid.buyerCounterpartyId,
        amountNet,
        currency: "AZN",
        lineCount: paid.lineCount,
        channel: "COUNTER",
        paymentMethod: method,
        fiscalNumber: fiscalNumber ?? undefined,
      },
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
