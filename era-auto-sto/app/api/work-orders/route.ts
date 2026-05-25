import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  code: z.string(),
  vehiclePlate: z.string().optional(),
  laborAmount: z.number().nonnegative().default(0),
  partsAmount: z.number().nonnegative().default(0),
});

export async function GET() {
  try {
    const orders = await prisma.workOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const order = await prisma.workOrder.create({
      data: {
        code: body.code,
        vehiclePlate: body.vehiclePlate,
        laborAmount: body.laborAmount,
        partsAmount: body.partsAmount,
      },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
