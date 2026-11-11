import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { SATELLITE_LOGISTICS_TRIP_COMPLETED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPortalLink, createShipment, createPaymentLink, createBookingSlot, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { findTripWithVehicle, completeTrip } from "@/lib/trip.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  customHostname: z.string().max(253).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/trips/:id/complete", async (httpReq, httpRes) => {
    if (!(await enterLogisticsStaff(httpReq, httpRes))) return;
    try {
      const session = await logisticsNestSession(httpReq);
      const web = await runWithLogisticsTenant(session, async () => {
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
    const trip = await findTripWithVehicle(id);
    if (!trip) return sendJson(httpRes, { error: "Trip not found" }, 404);
    if (trip.status === "COMPLETED") return sendJson(httpRes, trip);

    const completed = await completeTrip(id);

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
    const organizationId = requestOrganizationId();
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

    return sendJson(httpRes, completed);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
