import { prisma } from "@/lib/prisma";

export async function journalTicketBundles(outletId: string, start: Date, end: Date) {
  const [closed, open, holders] = await Promise.all([
    prisma.ticket.findMany({
      where: { outletId, status: "CLOSED", closedAt: { gte: start, lt: end } },
      include: { table: true },
      orderBy: { closedAt: "asc" },
    }),
    prisma.ticket.findMany({
      where: { outletId, status: { in: ["OPEN", "HELD"] } },
      include: { table: true },
      orderBy: { openedAt: "asc" },
    }),
    prisma.fnbLimitHolder.findMany({ select: { id: true, displayName: true } }),
  ]);
  return { closed, open, holders };
}

export async function handoverOutletAndTickets(outletId: string, start: Date, end: Date) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  const closed = await prisma.ticket.findMany({
    where: { outletId, status: "CLOSED", closedAt: { gte: start, lt: end } },
    orderBy: { closedAt: "asc" },
  });
  return { outlet, closed };
}

export async function dashboardTodayBundle(start: Date, end: Date) {
  const [openedToday, openNow, occupiedTables, closed] = await Promise.all([
    prisma.ticket.count({
      where: { openedAt: { gte: start, lte: end }, status: { not: "VOID" } },
    }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "HELD"] } } }),
    prisma.posTable.count({ where: { status: "OCCUPIED" } }),
    prisma.ticket.findMany({
      where: {
        status: "CLOSED",
        closedAt: { gte: start, lte: end },
      },
      select: {
        totalAzn: true,
        lines: {
          where: { kitchenStatus: { not: "VOID" } },
          select: {
            description: true,
            qty: true,
            menuItem: { select: { category: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  return { openedToday, openNow, occupiedTables, closed };
}
