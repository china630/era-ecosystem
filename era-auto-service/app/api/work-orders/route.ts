import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  code: z.string(),
  vehicleId: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vin: z.string().optional(),
  laborAmount: z.number().nonnegative().default(0),
  partsAmount: z.number().nonnegative().default(0),
});

export async function GET() {
  try {
    const orders = await prisma.workOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { vehicle: true },
    });
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    let vehicleId = body.vehicleId;
    if (!vehicleId && body.vehiclePlate) {
      const v = await prisma.customerVehicle.upsert({
        where: { plate: body.vehiclePlate.toUpperCase() },
        create: {
          plate: body.vehiclePlate.toUpperCase(),
          vin: body.vin?.trim(),
        },
        update: { vin: body.vin?.trim() ?? undefined },
      });
      vehicleId = v.id;
    }
    const order = await prisma.workOrder.create({
      data: {
        code: body.code,
        vehicleId,
        vehiclePlate: body.vehiclePlate?.toUpperCase(),
        vin: body.vin?.trim(),
        laborAmount: body.laborAmount,
        partsAmount: body.partsAmount,
      },
      include: { vehicle: true, laborLines: true, partLines: true },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
