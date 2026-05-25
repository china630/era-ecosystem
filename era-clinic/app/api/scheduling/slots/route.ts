import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  practitionerCode: z.string().optional(),
  date: z.string().optional(),
});

function buildSlotTimes(date: Date): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour < 17; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse({
      practitionerCode: url.searchParams.get("practitionerCode") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });

    const day = query.date ? new Date(query.date) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const where = {
      scheduledAt: { gte: day, lt: nextDay },
      ...(query.practitionerCode
        ? { practitioner: { code: query.practitionerCode } }
        : {}),
    };

    const booked = await prisma.appointment.findMany({
      where,
      select: { scheduledAt: true, practitioner: { select: { code: true } } },
    });

    const slotTimes = buildSlotTimes(day);
    const availableSlots = slotTimes.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const slotAt = new Date(day);
      slotAt.setHours(hours, minutes, 0, 0);
      const taken = booked.some(
        (appt) => appt.scheduledAt.getTime() === slotAt.getTime(),
      );
      return { time, available: !taken };
    });

    return jsonOk({
      date: day.toISOString().slice(0, 10),
      practitionerCode: query.practitionerCode ?? null,
      slots: availableSlots,
      source: "scheduling_stub",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
