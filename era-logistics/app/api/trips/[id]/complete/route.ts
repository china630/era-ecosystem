import { SATELLITE_LOGISTICS_TRIP_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
