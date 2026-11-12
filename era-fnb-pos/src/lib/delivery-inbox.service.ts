import { prisma } from "@/lib/prisma";

export function listOpenDeliveryInboxOrders() {
  return prisma.deliveryInboxOrder.findMany({
    where: { status: { in: ["NEW", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function createDeliveryInboxOrder(data: {
  externalRef: string;
  channel: string;
  payloadJson: string | null;
}) {
  return prisma.deliveryInboxOrder.create({ data });
}

export function findDeliveryInboxOrderById(id: string) {
  return prisma.deliveryInboxOrder.findUnique({ where: { id } });
}

export function acceptDeliveryInboxOrder(id: string) {
  return prisma.deliveryInboxOrder.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });
}
