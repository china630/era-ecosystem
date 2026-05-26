import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import {
  createBookingSlot,
  createShipment,
} from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  pickupSlotKey: z.string().default("pickup"),
  customerPhone: z.string().max(32).optional(),
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
      include: { outlet: true },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status !== "OPEN") {
      return jsonError("BOPIS only on OPEN receipt", 400);
    }

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        fulfillmentType: "BOPIS",
        pickupSlotKey: body.pickupSlotKey,
        bopisScheduledAt: new Date(),
        customerPhone: body.customerPhone?.trim() || receipt.customerPhone,
      },
    });

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
    if (organizationId) {
      try {
        await createBookingSlot(
          {
            resourceKey: body.pickupSlotKey,
            label: `Pickup ${receipt.id.slice(0, 8)}`,
            metadata: { receiptId: receipt.id },
          },
          { organizationId },
        );
      } catch {
        // optional CP booking
      }
      try {
        await createShipment(
          {
            sourceEntityType: "retail_receipt",
            sourceEntityId: receipt.id,
            externalRef: body.customerPhone ?? receipt.id,
            metadata: { fulfillmentType: "BOPIS" },
          },
          { organizationId },
        );
      } catch {
        // optional CP delivery
      }
    }

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
