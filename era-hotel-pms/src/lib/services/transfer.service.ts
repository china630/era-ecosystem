import type { TransferDirection } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';

export async function listTransferOrders(filters?: {
  from?: Date;
  to?: Date;
  reservationId?: string;
  status?: string;
  direction?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.reservationId) where.reservationId = filters.reservationId;
  if (filters?.status) where.status = filters.status;
  if (filters?.direction) where.direction = filters.direction;
  if (filters?.from || filters?.to) {
    where.pickupAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return prisma.transferOrder.findMany({
    where,
    include: {
      vehicle: true,
      reservation: { include: { guest: true, room: true } },
    },
    orderBy: { pickupAt: 'asc' },
  });
}

export async function listVehicles(activeOnly = true) {
  return prisma.transferVehicle.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: 'asc' },
  });
}

export async function createTransferOrder(input: {
  reservationId: string;
  direction: TransferDirection;
  flightNo?: string;
  pickupAt: Date;
  vehicleId?: string;
  price: number;
  notes?: string;
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
  });
  if (!reservation || !['CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
    throw new Error('Reservation must be CONFIRMED or IN_HOUSE');
  }

  if (input.vehicleId) {
    const vehicle = await prisma.transferVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle || !vehicle.active) throw new Error('Vehicle not found or inactive');
  }

  return prisma.transferOrder.create({
    data: {
      reservationId: input.reservationId,
      direction: input.direction,
      flightNo: input.flightNo,
      pickupAt: input.pickupAt,
      vehicleId: input.vehicleId,
      price: input.price,
      notes: input.notes,
      status: input.vehicleId ? 'CONFIRMED' : 'BOOKED',
    },
    include: {
      vehicle: true,
      reservation: { include: { guest: true, room: true } },
    },
  });
}

export async function assignVehicle(id: string, vehicleId: string) {
  const order = await prisma.transferOrder.findUnique({ where: { id } });
  if (!order) throw new Error('Transfer order not found');
  if (['DONE', 'CANCELLED'].includes(order.status)) {
    throw new Error('Cannot assign vehicle to a completed or cancelled transfer');
  }

  const vehicle = await prisma.transferVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || !vehicle.active) throw new Error('Vehicle not found or inactive');

  return prisma.transferOrder.update({
    where: { id },
    data: { vehicleId, status: 'CONFIRMED' },
    include: {
      vehicle: true,
      reservation: { include: { guest: true, room: true } },
    },
  });
}

export async function completeTransfer(id: string) {
  const order = await prisma.transferOrder.findUnique({
    where: { id },
    include: { reservation: true },
  });
  if (!order) throw new Error('Transfer order not found');
  if (order.status === 'DONE') throw new Error('Transfer already completed');
  if (order.status === 'CANCELLED') throw new Error('Cannot complete a cancelled transfer');

  let folioCharged = order.folioCharged;
  if (!folioCharged) {
    const transferCode = await prisma.revenueCode.findUnique({ where: { code: 'TRANSFER' } });
    if (!transferCode) throw new Error('Revenue code TRANSFER not configured');
    const directionLabel = order.direction === 'IN' ? 'Airport pickup' : 'Airport drop-off';
    await postCharge({
      reservationId: order.reservationId,
      revenueCodeId: transferCode.id,
      amount: decimalToNumber(order.price),
      description: `${directionLabel}${order.flightNo ? ` (${order.flightNo})` : ''}`,
      businessDate: new Date(),
    });
    folioCharged = true;
  }

  return prisma.transferOrder.update({
    where: { id },
    data: { status: 'DONE', folioCharged },
    include: {
      vehicle: true,
      reservation: { include: { guest: true, room: true } },
    },
  });
}
