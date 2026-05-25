import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  liters: z.number().positive(),
  cost: z.number().nonnegative(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);

    const updated = await prisma.trip.update({
      where: { id },
      data: {
        fuelLiters: body.liters,
        fuelCost: body.cost,
      },
      include: { vehicle: true },
    });

    return jsonOk({
      tripId: updated.id,
      liters: Number(updated.fuelLiters),
      cost: Number(updated.fuelCost),
      currency: "AZN",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);

    return jsonOk({
      tripId: trip.id,
      liters: trip.fuelLiters ? Number(trip.fuelLiters) : null,
      cost: trip.fuelCost ? Number(trip.fuelCost) : null,
      currency: "AZN",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
