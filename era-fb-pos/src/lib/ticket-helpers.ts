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
  await prisma.posTable.update({
    where: { id: tableId },
    data: { status: "FREE", currentTicketId: null },
  });
}
