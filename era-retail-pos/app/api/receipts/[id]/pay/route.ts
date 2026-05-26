import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPaymentLink,
  createBookingSlot,
  createShipment,
  createPortalLink,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { isRetailPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  paymentMethod: z.string().default("cash"),
  delivery: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: true,
        outlet: true,
        register: true,
        shift: true,
      },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "PAID") return jsonOk(receipt);

    const paid = await prisma.receipt.update({
      where: { id },
      data: {
        status: "PAID",
        paymentMethod: body.paymentMethod,
        paidAt: new Date(),
      },
      include: { lines: true },
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
    const amountNet = Number(receipt.amountNet);

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: receipt.outletId,
        registerId: receipt.registerId,
        shiftId: receipt.shiftId,
        receiptId: receipt.id,
        preset,
        amountNet,
        currency: "AZN",
        paymentMethod: body.paymentMethod,
        lineCount: receipt.lines.length,
      },
    });

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
    const recipient =
      process.env.RETAIL_NOTIFY_RECIPIENT?.trim() || `receipt-${receipt.id}@local`;
    let payUrl: string | undefined;
    if (organizationId) {
      try {
        const link = (await createPaymentLink(
          {
            amountAzn: amountNet,
            sourceEntityType: "retail_receipt",
            sourceEntityId: receipt.id,
            description: `Receipt ${receipt.id}`,
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
            entityType: "retail_receipt",
            entityId: receipt.id,
          },
          { organizationId },
        );
      } catch {
        // optional portal link
      }
      try {
        await createBookingSlot(
          {
            resourceKey: "pickup",
            resourceName: "Click and collect",
            startsAt: new Date(Date.now() + 3600_000).toISOString(),
            endsAt: new Date(Date.now() + 7200_000).toISOString(),
            capacity: 8,
          },
          { organizationId },
        );
      } catch {
        // optional pickup slot
      }
      const wantsDelivery =
        body.delivery === true || presetRaw === "ecommerce";
      if (wantsDelivery) {
        try {
          await createShipment(
            {
              sourceEntityType: "retail_receipt",
              sourceEntityId: receipt.id,
              externalRef: receipt.id,
              recipientPhone: process.env.RETAIL_NOTIFY_PHONE?.trim(),
            },
            { organizationId },
          );
        } catch {
          // optional platform delivery
        }
      }
      try {
        await createPromotion(
          {
            code: `RETAIL-SALE-${receipt.id.slice(0, 8)}`,
            name: "Retail sale promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { receiptId: receipt.id },
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
              metadata: { receiptId: receipt.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }
    await trySendPlatformNotification({
      templateKey: "retail.sale.completed",
      channel: "EMAIL",
      messageClass: "TRANSACTIONAL",
      recipient,
      sourceEntityType: "retail_receipt",
      sourceEntityId: receipt.id,
      body: `Sale ${amountNet.toFixed(2)} AZN${payUrl ? ` — pay: ${payUrl}` : ""}`,
      payload: { amountNet, preset, payUrl },
    });

    return jsonOk(paid);
  } catch (err) {
    return handleRouteError(err);
  }
}
