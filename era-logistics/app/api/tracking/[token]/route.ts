import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const trip = await prisma.trip.findUnique({
      where: { trackingToken: token },
      include: {
        vehicle: true,
        points: { orderBy: { sequence: "asc" } },
      },
    });
    if (!trip) return jsonError("Tracking not found", 404);
    return jsonOk({
      tripId: trip.id,
      status: trip.status,
      vehiclePlate: trip.vehicle.plate,
      stops: trip.points.map((p) => ({
        sequence: p.sequence,
        addressLabel: p.addressLabel,
        status: p.status,
      })),
      portalStub: `/platform/portal?subject=logistics_trip&subjectId=${trip.id}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
