import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function applyDiscount(subtotal: number, discountPercent: number): number {
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.round(subtotal * (1 - pct / 100) * 100) / 100;
}

export async function recalculateTicketTotals(ticketId: string) {
  const [lines, ticket] = await Promise.all([
    prisma.ticketLine.findMany({
      where: { ticketId, kitchenStatus: { not: "VOID" } },
    }),
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { discountPercent: true },
    }),
  ]);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.qty * Number(line.unitPriceAzn),
    0,
  );
  const discountPercent = Number(ticket?.discountPercent ?? 0);
  const total = applyDiscount(subtotal, discountPercent);
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { subtotalAzn: subtotal, totalAzn: total },
  });
}

export async function releaseTableForTicket(ticketId: string, tableId: string | null) {
  if (!tableId) return;
  await prisma.posTable.updateMany({
    where: {
      id: tableId,
      OR: [{ currentTicketId: ticketId }, { currentTicketId: null }],
    },
    data: { status: "FREE", currentTicketId: null },
  });
}

/** Free tables still marked occupied after their check was voided or closed. */
export async function freeTablesStuckOnDeadTickets(organizationId: string): Promise<number> {
  const tables = await prisma.posTable.findMany({
    where: { organizationId, status: "OCCUPIED", currentTicketId: { not: null } },
    select: { id: true, currentTicketId: true },
  });
  let freed = 0;
  for (const table of tables) {
    if (!table.currentTicketId) continue;
    const ticket = await prisma.ticket.findUnique({
      where: { id: table.currentTicketId },
      select: { status: true },
    });
    if (ticket && (ticket.status === "OPEN" || ticket.status === "HELD")) continue;
    await prisma.posTable.update({
      where: { id: table.id },
      data: { status: "FREE", currentTicketId: null },
    });
    freed += 1;
  }
  return freed;
}

export async function daySeqMap(organizationId: string): Promise<Map<string, number>> {
  const { start, end } = bakuDayBounds(todayBakuYmd());
  const rows = await prisma.ticket.findMany({
    where: { organizationId, openedAt: { gte: start, lt: end } },
    orderBy: { openedAt: "asc" },
    select: { id: true },
  });
  return new Map(rows.map((row, index) => [row.id, index + 1]));
}

export async function attachDayNos<T extends { id: string; organizationId: string }>(
  tickets: T[],
): Promise<(T & { dayNo: number | null })[]> {
  if (tickets.length === 0) return [];
  const map = await daySeqMap(tickets[0]!.organizationId);
  return tickets.map((ticket) => ({
    ...ticket,
    dayNo: map.get(ticket.id) ?? null,
  }));
}

/** Drop open checks that never received a dish, and free their tables. Skips banquet (BEO). */
export async function voidEmptyOpenTickets(organizationId: string): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      status: { in: ["OPEN", "HELD"] },
      beoId: null,
    },
    include: { lines: { select: { kitchenStatus: true } } },
  });
  let voided = 0;
  for (const ticket of tickets) {
    const live = ticket.lines.some((line) => line.kitchenStatus !== "VOID");
    if (live) continue;
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "VOID", closedAt: new Date() },
    });
    await releaseTableForTicket(ticket.id, ticket.tableId);
    voided += 1;
  }
  await freeTablesStuckOnDeadTickets(organizationId);
  return voided;
}

export async function voidTicketIfNoLiveLines(ticketId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { lines: { select: { kitchenStatus: true } } },
  });
  if (!ticket) return false;
  const live = ticket.lines.some((line) => line.kitchenStatus !== "VOID");
  if (live) return false;
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "VOID", closedAt: new Date() },
  });
  await releaseTableForTicket(ticketId, ticket.tableId);
  return true;
}
