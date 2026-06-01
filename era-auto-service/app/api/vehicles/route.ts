import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  plate: z.string().min(2).max(16),
  vin: z.string().max(32).optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  financeCounterpartyId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const plate = new URL(req.url).searchParams.get("plate")?.trim();
    const vehicles = await prisma.customerVehicle.findMany({
      where: plate ? { plate: { contains: plate, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { workOrders: true } } },
    });
    return jsonOk(vehicles);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const vehicle = await prisma.customerVehicle.upsert({
      where: { plate: body.plate.toUpperCase() },
      create: {
        plate: body.plate.toUpperCase(),
        vin: body.vin?.trim(),
        customerName: body.customerName,
        phone: body.phone,
        financeCounterpartyId: body.financeCounterpartyId,
      },
      update: {
        vin: body.vin?.trim(),
        customerName: body.customerName,
        phone: body.phone,
        financeCounterpartyId: body.financeCounterpartyId,
      },
    });
    return jsonOk(vehicle, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
