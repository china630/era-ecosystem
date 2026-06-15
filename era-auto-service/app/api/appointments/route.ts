import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { nextServiceAppointmentDay } from "@/lib/production-calendar";
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
    let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    const iso = scheduledAt.toISOString().slice(0, 10);
    const snappedIso = await nextServiceAppointmentDay(iso);
    if (snappedIso !== iso) {
      scheduledAt = new Date(`${snappedIso}T${scheduledAt.toISOString().slice(11, 19)}.000Z`);
    }
    const appointment = await prisma.appointment.create({
      data: {
        vehiclePlate: body.vehiclePlate,
        customerName: body.customerName,
        scheduledAt,
      },
    });
    return jsonOk({ ...appointment, calendarAdjusted: snappedIso !== iso }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
