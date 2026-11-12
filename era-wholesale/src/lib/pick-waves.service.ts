import { prisma } from "@/lib/prisma";

export function listPickListsWithWaveCode() {
  return prisma.pickList.findMany({
    where: { waveCode: { not: null } },
    include: { order: true, lines: true },
    orderBy: { waveCode: "asc" },
  });
}

export function findB2BOrderByOrderNumber(orderNumber: string) {
  return prisma.b2BOrder.findUnique({
    where: { orderNumber } as never,
  });
}

export function upsertPickListForWave(orderId: string, waveCode: string) {
  return prisma.pickList.upsert({
    where: { orderId },
    create: {
      orderId,
      waveCode,
      lines: {
        create: [{ skuCode: "WAVE-PLACEHOLDER", qtyOrdered: 1 }],
      },
    },
    update: { waveCode },
  });
}
