import { SATELLITE_WHOLESALE_ORDER_CONFIRMED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPaymentLink,
  createPortalLink,
  createShipment,
  createBookingSlot,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  delivery: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const order = await prisma.b2BOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "CONFIRMED") return jsonOk(order);

    const confirmed = await prisma.b2BOrder.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

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

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
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

    return jsonOk(confirmed);
  } catch (err) {
    return handleRouteError(err);
  }
}
