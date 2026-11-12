import { prisma } from "@/lib/prisma";

export function listPickLists(take = 100) {
  return prisma.pickList.findMany({
    include: { order: true, lines: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function findB2BOrderByOrderNumber(orderNumber: string) {
  return prisma.b2BOrder.findUnique({
    where: { orderNumber } as never,
  });
}

export function findPickListByOrderId(orderId: string) {
  return prisma.pickList.findUnique({
    where: { orderId },
  });
}

export function createPickListWithLines(
  orderId: string,
  lines: { skuCode: string; qtyOrdered: number }[],
) {
  return prisma.pickList.create({
    data: {
      orderId,
      lines: {
        create: lines.map((line) => ({
          skuCode: line.skuCode,
          qtyOrdered: line.qtyOrdered,
        })),
      },
    },
    include: { order: true, lines: true },
  });
}

export function findPickListLine(pickListId: string, lineId: string) {
  return prisma.pickListLine.findFirst({
    where: { id: lineId, pickListId },
    include: { pickList: { include: { lines: true } } },
  });
}

export function updatePickListLineQty(lineId: string, qtyPicked: number) {
  return prisma.pickListLine.update({
    where: { id: lineId },
    data: { qtyPicked },
  });
}

export function findPickListByIdWithOrderAndLines(id: string) {
  return prisma.pickList.findUnique({
    where: { id },
    include: { order: true, lines: true },
  });
}

export function markPickListPicked(id: string) {
  return prisma.pickList.update({
    where: { id },
    data: { status: "PICKED" },
  });
}
