import { prisma } from "@/lib/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function recalculateTicketTotals(ticketId: string) {
  const lines = await prisma.ticketLine.findMany({
    where: { ticketId, kitchenStatus: { not: "VOID" } },
  });
  const subtotal = lines.reduce(
    (sum, line) => sum + line.qty * Number(line.unitPriceAzn),
    0,
  );
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { subtotalAzn: subtotal, totalAzn: subtotal },
  });
}

export async function releaseTableForTicket(ticketId: string, tableId: string | null) {
  if (!tableId) return;
  await prisma.posTable.update({
    where: { id: tableId },
    data: { status: "FREE", currentTicketId: null },
  });
}
