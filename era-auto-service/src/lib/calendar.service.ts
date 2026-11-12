import { prisma } from "@/lib/prisma";

export async function getShopCalendarSnapshot() {
  const since = new Date(Date.now() - 86400000);
  const [bays, appointments] = await Promise.all([
    prisma.bay.findMany({ include: { lifts: true }, orderBy: { code: "asc" } }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: since } },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    }),
  ]);
  return { bays, appointments };
}
