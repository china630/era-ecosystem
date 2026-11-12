import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_WHOLESALE_ORDER_CONFIRMED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPaymentLink, createPortalLink, createShipment, createBookingSlot, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { confirmB2BOrder, findB2BOrderById } from "@/lib/b2b-order.service";
import { consumeTradeCreditGrant, createTradeCreditRequestCache, probeTradeCreditSku } from "@/lib/credit-limit";
import { z } from "zod";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  delivery: z.boolean().optional(),
  customHostname: z.string().optional(),
  /** Pickup grant code — required when on-account and trade credit SKU is on. */
  grantCode: z.string().min(8).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/orders/:id/confirm", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse((httpReq.body ?? {}));
    const order = await findB2BOrderById(id);
    if (!order) return sendJson(httpRes, { error: "Order not found" }, 404);
    if (order.status === "CONFIRMED") return sendJson(httpRes, order);

    const organizationId = requestOrganizationId();
    const onAccount = (order.paymentTermDays ?? 0) > 0;
    let tradeCreditGrantId: string | null = order.tradeCreditGrantId ?? null;

    if (onAccount) {
      const authHeader =
        req.headers.get("authorization") ??
        (process.env.FINANCE_API_TOKEN
          ? `Bearer ${process.env.FINANCE_API_TOKEN}`
          : null);
      const cache = createTradeCreditRequestCache();
      const probe = await probeTradeCreditSku(
        order.buyerCounterpartyId,
        authHeader,
        cache,
        organizationId,
      );

      if (probe.status === "unknown") {
        return sendJson(httpRes, { error: 
          probe.error ??
            "Trade credit status unknown — cannot confirm on-account without Finance" }, 503);
      }

      if (probe.status === "on") {
        if (probe.facility?.stopList) {
          return sendJson(httpRes, { error: 
            "Counterparty is on trade-credit stop-list; prepaid only" }, 409);
        }
        const code = body.grantCode?.trim();
        if (!code) {
          return sendJson(httpRes, { error: 
            "grantCode is required for on-account confirm when trade credit is enabled" }, 400);
        }
        const consumed = await consumeTradeCreditGrant({
          organizationId,
          counterpartyId: order.buyerCounterpartyId,
          code,
          amount: Number(order.amountNet),
          sourceEntityType: "wholesale_order",
          sourceEntityId: order.id,
          authHeader,
        });
        if (!consumed.ok) {
          const status =
            consumed.status === 402 || consumed.status === 409
              ? consumed.status
              : consumed.status >= 400 && consumed.status < 600
                ? consumed.status
                : 409;
          return sendJson(httpRes, { error: consumed.error }, status);
        }
        tradeCreditGrantId = consumed.grantId;
      }
    }

    const confirmed = await confirmB2BOrder(id, tradeCreditGrantId);

    await dispatchSatelliteEvent({
      type: SATELLITE_WHOLESALE_ORDER_CONFIRMED,
      payload: {
        orderId: confirmed.id,
        buyerCounterpartyId: confirmed.buyerCounterpartyId,
        amountNet: Number(confirmed.amountNet),
        currency: "AZN",
        lineCount: confirmed.lineCount,
      },
    });

    const amountNet = Number(confirmed.amountNet);
    let payUrl: string | undefined;
    if (organizationId) {
      try {
        const link = (await createPaymentLink(
          {
            amountAzn: amountNet,
            counterpartyRef: confirmed.buyerCounterpartyId,
            sourceEntityType: "wholesale_order",
            sourceEntityId: confirmed.id,
            description: `B2B order ${confirmed.id}`,
          },
          { organizationId },
        )) as { paymentUrl?: string; portalPayUrl?: string };
        payUrl = link.paymentUrl ?? link.portalPayUrl;
      } catch {
        payUrl = undefined;
      }
      try {
        await createPortalLink(
          {
            entityType: "wholesale_order",
            entityId: confirmed.id,
          },
          { organizationId },
        );
      } catch {
        // optional portal link
      }
      if (body.delivery === true) {
        try {
          await createShipment(
            {
              sourceEntityType: "wholesale_order",
              sourceEntityId: confirmed.id,
              externalRef: confirmed.buyerCounterpartyId,
            },
            { organizationId },
          );
        } catch {
          // optional B2B delivery
        }
      }
      try {
        await createBookingSlot(
          {
            resourceKey: "pickup",
            resourceName: "B2B pickup",
            startsAt: new Date(Date.now() + 86400_000).toISOString(),
            endsAt: new Date(Date.now() + 90000_000).toISOString(),
            capacity: 12,
            metadata: { orderId: confirmed.id },
          },
          { organizationId },
        );
      } catch {
        // optional pickup slot
      }
      try {
        await createPromotion(
          {
            code: `B2B-ORDER-${confirmed.id.slice(0, 8)}`,
            name: "Wholesale order promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { orderId: confirmed.id },
          },
          { organizationId },
        );
      } catch {
        // optional loyalty
      }
      if (body.customHostname?.trim()) {
        try {
          await createCustomDomain(
            {
              hostname: body.customHostname.trim(),
              metadata: { orderId: confirmed.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }
    await trySendPlatformNotification({
      templateKey: "wholesale.order.confirmed",
      channel: "EMAIL",
      messageClass: "FINANCIAL",
      recipient: confirmed.buyerCounterpartyId,
      sourceEntityType: "wholesale_order",
      sourceEntityId: confirmed.id,
      body: `Order confirmed: ${amountNet.toFixed(2)} AZN${payUrl ? ` — ${payUrl}` : ""}`,
      payload: { amountNet, payUrl },
    });

    return sendJson(httpRes, confirmed);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
