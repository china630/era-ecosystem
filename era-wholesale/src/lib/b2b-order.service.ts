import { prisma } from "@/lib/prisma";

export function listB2BOrders(take = 100) {
  return prisma.b2BOrder.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function createB2BOrder(data: {
  orderNumber: string;
  buyerCounterpartyId: string;
  amountNet: number;
  lineCount: number;
  channel: string;
  paymentTermDays?: number;
}) {
  return prisma.b2BOrder.create({
    data: {
      orderNumber: data.orderNumber,
      buyerCounterpartyId: data.buyerCounterpartyId,
      amountNet: data.amountNet,
      lineCount: data.lineCount,
      channel: data.channel,
      ...(data.paymentTermDays != null
        ? { paymentTermDays: data.paymentTermDays }
        : {}),
    },
  });
}

export function findB2BOrderById(id: string) {
  return prisma.b2BOrder.findUnique({ where: { id } });
}

export function settleCounterOrderPaid(
  id: string,
  method: string,
  fiscalNumber: string | null,
) {
  return prisma.b2BOrder.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      paymentMethod: method,
      fiscalNumber,
      paidAt: new Date(),
    },
  });
}

export function issueOrderTtn(id: string, ttnNumber: string) {
  return prisma.b2BOrder.update({
    where: { id },
    data: { ttnNumber, ttnIssuedAt: new Date() },
  });
}

export function confirmB2BOrder(
  id: string,
  tradeCreditGrantId: string | null,
) {
  return prisma.b2BOrder.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      ...(tradeCreditGrantId ? { tradeCreditGrantId } : {}),
    },
  });
}

export function listB2BOrdersForEdiExport(take = 100) {
  return prisma.b2BOrder.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { pickList: { include: { lines: true } } },
  });
}
