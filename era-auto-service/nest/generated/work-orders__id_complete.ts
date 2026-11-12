import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_AUTO_WORK_ORDER_COMPLETED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { z } from "zod";
import { createPortalLink, createPaymentLink, createShipment, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { recalcWorkOrderTotals } from "@/lib/work-order-lines";
import { completeWorkOrder, findWorkOrderById } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  partsDelivered: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/work-orders/:id/complete", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse((httpReq.body ?? {}));
    const { id } = httpReq.params;
    const order = await findWorkOrderById(id);
    if (!order) return sendJson(httpRes, { error: "Work order not found" }, 404);
    if (order.status === "COMPLETED") return sendJson(httpRes, order);

    await recalcWorkOrderTotals(id);
    const refreshed = await findWorkOrderById(id);
    if (!refreshed) return sendJson(httpRes, { error: "Work order not found" }, 404);

    const completed = await completeWorkOrder(id);

    await dispatchSatelliteEvent({
      type: SATELLITE_AUTO_WORK_ORDER_COMPLETED,
      payload: {
        workOrderId: completed.id,
        vehiclePlate: completed.vehiclePlate ?? undefined,
        laborAmount: Number(completed.laborAmount),
        partsAmount: Number(completed.partsAmount),
        currency: "AZN",
      },
    });

    const organizationId = requestOrganizationId();
    const amountAzn =
      Number(completed.laborAmount) + Number(completed.partsAmount);
    let payUrl: string | undefined;
    if (organizationId && amountAzn > 0) {
      try {
        const link = (await createPaymentLink(
          {
            amountAzn,
            sourceEntityType: "auto_work_order",
            sourceEntityId: completed.id,
            description: `Work order ${completed.vehiclePlate ?? completed.id}`,
          },
          { organizationId },
        )) as { paymentUrl?: string; portalPayUrl?: string };
        payUrl = link.paymentUrl ?? link.portalPayUrl;
      } catch {
        payUrl = undefined;
      }
      try {
        await createPortalLink(
          { entityType: "auto_work_order", entityId: completed.id },
          { organizationId },
        );
      } catch {
        // optional portal
      }
      if (body.partsDelivered !== false) {
        try {
          await createShipment(
            {
              sourceEntityType: "auto_work_order",
              sourceEntityId: completed.id,
              externalRef: completed.vehiclePlate ?? completed.id,
            },
            { organizationId },
          );
        } catch {
          // optional parts delivery
        }
      }
      try {
        await createPromotion(
          {
            code: `AUTO-WO-${completed.id.slice(0, 8)}`,
            name: "Auto STO promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { workOrderId: completed.id },
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
              metadata: { workOrderId: completed.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }

    const recipient =
      process.env.AUTO_NOTIFY_RECIPIENT?.trim() ||
      completed.vehiclePlate ||
      completed.id;
    await trySendPlatformNotification({
      templateKey: "auto.work_order.completed",
      channel: "EMAIL",
      messageClass: "TRANSACTIONAL",
      recipient,
      sourceEntityType: "auto_work_order",
      sourceEntityId: completed.id,
      body: `Work order done: ${amountAzn.toFixed(2)} AZN${payUrl ? ` — ${payUrl}` : ""}`,
      payload: { amountAzn, payUrl },
    });

    return sendJson(httpRes, completed);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
