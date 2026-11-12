import { prisma } from "@/lib/prisma";

const KDS_LINE_INCLUDE = {
  ticket: { include: { table: true, outlet: true } },
} as const;

export function listKdsActiveTicketLines() {
  return prisma.ticketLine.findMany({
    where: { kitchenStatus: { in: ["NEW", "FIRED", "IN_PREP"] } },
    include: KDS_LINE_INCLUDE,
    orderBy: { ticket: { openedAt: "asc" } },
    take: 100,
  });
}

export function findTicketLineById(lineId: string) {
  return prisma.ticketLine.findUnique({ where: { id: lineId } });
}

export function updateTicketLineKitchenStatus(
  lineId: string,
  kitchenStatus: "IN_PREP" | "DONE",
) {
  return prisma.ticketLine.update({
    where: { id: lineId },
    data: { kitchenStatus },
    include: KDS_LINE_INCLUDE,
  });
}
