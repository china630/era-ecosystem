import { SATELLITE_AUTO_WORK_ORDER_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { z } from "zod";
import {
  createPortalLink,
  createPaymentLink,
  createShipment,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  partsDelivered: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const { id } = await params;
    const order = await prisma.workOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Work order not found", 404);
    if (order.status === "COMPLETED") return jsonOk(order);

    const completed = await prisma.workOrder.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

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

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
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

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
