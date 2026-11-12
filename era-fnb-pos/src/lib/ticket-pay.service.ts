import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shiftIdCovering } from "@/lib/open-shift";

export async function findTicketForPay(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { table: true, outlet: true, lines: true },
  });
}

export async function findOpenPosShiftDevices(outletId: string) {
  return prisma.posShift.findFirst({
    where: { outletId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

export async function takeLimitHolderCredit(params: {
  limitHolderId: string;
  organizationId: string;
  due: number;
}) {
  const holder = await prisma.fnbLimitHolder.findFirst({
    where: { id: params.limitHolderId, organizationId: params.organizationId, active: true },
  });
  const nextUsed = holder ? holder.usedAzn.plus(params.due) : null;
  const taken = holder && nextUsed
    ? await prisma.fnbLimitHolder.updateMany({
        where: {
          id: holder.id,
          organizationId: params.organizationId,
          active: true,
          usedAzn: holder.usedAzn,
          ceilingAzn: { gte: nextUsed },
        },
        data: { usedAzn: nextUsed },
      })
    : { count: 0 };
  return taken;
}

export async function closeTicketOnPay(
  id: string,
  data: Prisma.TicketUncheckedUpdateInput,
) {
  await prisma.ticket.update({ where: { id }, data });
}

export async function findTicketForHubSettlement(sourceRef: string) {
  return prisma.ticket.findUnique({
    where: { id: sourceRef },
    include: { table: true },
  });
}

export async function updateTicketSettlementPendingId(ticketId: string, settlementPendingId: string) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { settlementPendingId },
  });
}

export async function closeTicketOnHubSettlement(params: {
  ticketId: string;
  closedAt: Date;
  outletId: string;
  pendingId: string;
  fiscalReceiptId: string | null;
}) {
  await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      status: "CLOSED",
      closedAt: params.closedAt,
      shiftId: await shiftIdCovering(params.outletId, params.closedAt),
      settlementPendingId: params.pendingId,
      hubFiscalReceiptId: params.fiscalReceiptId,
    },
  });
}
