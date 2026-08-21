import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import type { ConciergeOrderStatus } from '@prisma/client';

export async function listConciergeProducts(activeOnly = true) {
  return prisma.conciergeProduct.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: 'asc' },
  });
}

export async function createConciergeProduct(input: {
  code: string;
  name: string;
  category?: string;
  price: number;
  supplierName?: string;
  commissionPct?: number;
}) {
  return prisma.conciergeProduct.create({
    data: {
      ...input,
      price: toDecimal(input.price),
      commissionPct: input.commissionPct != null ? toDecimal(input.commissionPct) : undefined,
    },
  });
}

export async function listConciergeOrders(guestId?: string) {
  return prisma.conciergeOrder.findMany({
    where: guestId ? { guestId } : undefined,
    include: { product: true, guest: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function bookConciergeOrder(input: {
  guestId: string;
  productId: string;
  reservationId?: string;
  scheduledAt?: Date;
  notes?: string;
}) {
  return prisma.conciergeOrder.create({
    data: { ...input, status: 'REQUESTED' },
    include: { product: true },
  });
}

export async function completeConciergeOrder(orderId: string) {
  const order = await prisma.conciergeOrder.findUnique({
    where: { id: orderId },
    include: { product: true },
  });
  if (!order) throw new Error('Order not found');
  if (!order.reservationId) {
    return prisma.conciergeOrder.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });
  }

  const foodCode = await prisma.revenueCode.findFirst({ where: { code: 'FOOD' } as never });
  if (foodCode) {
    await postCharge({
      reservationId: order.reservationId,
      revenueCodeId: foodCode.id,
      amount: decimalToNumber(order.product.price),
      description: `Concierge: ${order.product.name}`,
    });
  }

  return prisma.conciergeOrder.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' },
  });
}

export async function updateConciergeOrderStatus(id: string, status: ConciergeOrderStatus) {
  return prisma.conciergeOrder.update({ where: { id }, data: { status } });
}
