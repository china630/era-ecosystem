import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const trips = await prisma.trip.findMany({
      where: { status: { in: ["PLANNED", "IN_TRANSIT"] } },
      include: {
        vehicle: true,
        points: { orderBy: { sequence: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return jsonOk({
      role: "driver",
      trips: trips.map((t) => ({
        id: t.id,
        status: t.status,
        vehiclePlate: t.vehicle.plate,
        stopCount: t.points.length,
        nextStop: t.points.find((p) => p.status !== "DELIVERED"),
        trackingToken: t.trackingToken,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
