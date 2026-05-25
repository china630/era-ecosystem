import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  vehiclePlate: z.string().min(1),
  customerName: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { workOrder: true },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
    return jsonOk(appointments);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const appointment = await prisma.appointment.create({
      data: {
        vehiclePlate: body.vehiclePlate,
        customerName: body.customerName,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
      },
    });
    return jsonOk(appointment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
