import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  vehiclePlate: z.string(),
  vehicleModel: z.string().optional(),
  routeCode: z.string().optional(),
  freightAmount: z.number().nonnegative().default(0),
});

export async function GET() {
  try {
    const trips = await prisma.trip.findMany({
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(trips);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    let vehicle = await prisma.vehicle.findUnique({
      where: { plate: body.vehiclePlate },
    });
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: { plate: body.vehiclePlate, model: body.vehicleModel },
      });
    }

    const trip = await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        routeCode: body.routeCode,
        freightAmount: body.freightAmount,
        status: "PLANNED",
      },
      include: { vehicle: true },
    });
    return jsonOk(trip, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
