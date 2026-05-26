import { z } from "zod";
import { SATELLITE_LOGISTICS_TRIP_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPortalLink,
  createShipment,
  createPaymentLink,
  createBookingSlot,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  customHostname: z.string().max(253).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!trip) return jsonError("Trip not found", 404);
    if (trip.status === "COMPLETED") return jsonOk(trip);

    const completed = await prisma.trip.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { vehicle: true },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_LOGISTICS_TRIP_COMPLETED,
      payload: {
        tripId: completed.id,
        vehicleId: completed.vehicleId,
        routeCode: completed.routeCode ?? undefined,
        freightAmount: Number(completed.freightAmount),
        currency: "AZN",
      },
    });

    const recipient =
      process.env.LOGISTICS_NOTIFY_RECIPIENT?.trim() ||
      completed.routeCode ||
      completed.id;
    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
    if (organizationId) {
      try {
        await createPortalLink(
          {
            entityType: "logistics_trip",
            entityId: completed.id,
          },
          { organizationId },
        );
      } catch {
        // optional portal
      }
      try {
        await createShipment(
          {
            sourceEntityType: "logistics_trip",
            sourceEntityId: completed.id,
            externalRef: completed.routeCode ?? completed.id,
          },
          { organizationId },
        );
      } catch {
        // optional delivery tracking
      }
      const freight = Number(completed.freightAmount);
      if (freight > 0) {
        try {
          await createPaymentLink(
            {
              amountAzn: freight,
              sourceEntityType: "logistics_trip",
              sourceEntityId: completed.id,
              description: `Freight ${completed.routeCode ?? completed.id}`,
            },
            { organizationId },
          );
        } catch {
          // optional payment link
        }
      }
      try {
        await createBookingSlot(
          {
            resourceKey: `delivery-${completed.routeCode ?? completed.id}`,
            resourceName: `Delivery window ${completed.routeCode ?? completed.id}`,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 14400_000).toISOString(),
            capacity: 2,
            metadata: { tripId: completed.id },
          },
          { organizationId },
        );
      } catch {
        // optional delivery window slot
      }
      try {
        await createPromotion(
          {
            code: `LOG-TRIP-${completed.id.slice(0, 8)}`,
            name: "Logistics trip promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { tripId: completed.id },
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
              metadata: { tripId: completed.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }

    await trySendPlatformNotification({
      templateKey: "logistics.trip.completed",
      channel: "SMS",
      messageClass: "TRANSACTIONAL",
      recipient,
      sourceEntityType: "logistics_trip",
      sourceEntityId: completed.id,
      body: `Trip ${completed.routeCode ?? completed.id} completed.`,
      payload: {
        freightAmount: Number(completed.freightAmount),
        routeCode: completed.routeCode,
      },
    });

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
