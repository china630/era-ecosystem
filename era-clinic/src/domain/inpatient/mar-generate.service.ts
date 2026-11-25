import { prisma } from "@/lib/prisma";
import { bakuDayBounds, bakuDateKey } from "@/lib/baku-day";

const HORIZON_HOURS = 48;

/** Parse frequency into Baku wall-clock HH:mm slots for one civil day. */
export function parseFrequencySlots(frequency: string | null | undefined): string[] {
  if (!frequency?.trim()) return ["08:00"];
  const trimmed = frequency.trim();
  const qMatch = /^q(\d+)h$/i.exec(trimmed);
  if (qMatch) {
    const every = Number.parseInt(qMatch[1]!, 10);
    if (every > 0 && every <= 24) {
      const slots: string[] = [];
      for (let h = 0; h < 24; h += every) {
        slots.push(`${String(h).padStart(2, "0")}:00`);
      }
      return slots.length ? slots : ["08:00"];
    }
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{1,2}:\d{2}$/.test(s));
  }
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return [trimmed];
  return ["08:00"];
}

function bakuSlotDate(dayYmd: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
  const { start } = bakuDayBounds(dayYmd);
  return new Date(start.getTime() + (h * 60 + m) * 60_000);
}

export async function generateMarAdministrationsForOrganization(organizationId: string) {
  const now = new Date();
  const end = new Date(now.getTime() + HORIZON_HOURS * 60 * 60 * 1000);
  const todayYmd = bakuDateKey(now);

  const orders = await prisma.inpatientOrder.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      prn: false,
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    select: {
      id: true,
      frequency: true,
      startAt: true,
      endAt: true,
    },
  });

  let created = 0;
  for (const order of orders) {
    const slots = parseFrequencySlots(order.frequency);
    const days = [todayYmd, bakuDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))];
    for (const day of days) {
      for (const slot of slots) {
        const scheduledAt = bakuSlotDate(day, slot);
        if (scheduledAt < order.startAt) continue;
        if (order.endAt && scheduledAt > order.endAt) continue;
        if (scheduledAt < now || scheduledAt > end) continue;

        const existing = await prisma.orderAdministration.findUnique({
          where: {
            orderId_scheduledAt: { orderId: order.id, scheduledAt },
          },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.orderAdministration.create({
          data: {
            orderId: order.id,
            scheduledAt,
            status: "DUE",
          },
        });
        created += 1;
      }
    }
  }

  return { created, orders: orders.length };
}