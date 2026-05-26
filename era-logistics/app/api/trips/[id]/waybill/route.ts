import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  waybillNumber: z.string().optional(),
});

export async function GET(
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
    return jsonOk({
      tripId: trip.id,
      waybillNumber: trip.waybillNumber,
      waybillIssuedAt: trip.waybillIssuedAt,
      vehiclePlate: trip.vehicle.plate,
      routeCode: trip.routeCode,
      freightAmount: Number(trip.freightAmount),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);

    const waybillNumber =
      body.waybillNumber?.trim() ||
      `WB-${trip.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const updated = await prisma.trip.update({
      where: { id },
      data: {
        waybillNumber,
        waybillIssuedAt: new Date(),
      },
      include: { vehicle: true },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
