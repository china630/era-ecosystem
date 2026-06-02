import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';

export async function listReservationPaymentCards(reservationId: string) {
  return prisma.reservationPaymentCard.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addReservationPaymentCard(
  reservationId: string,
  input: {
    lastFour: string;
    cardBrand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    holderName?: string;
  },
) {
  return prisma.reservationPaymentCard.create({
    data: {
      reservationId,
      lastFour: input.lastFour,
      cardBrand: input.cardBrand ?? null,
      expiryMonth: input.expiryMonth ?? null,
      expiryYear: input.expiryYear ?? null,
      holderName: input.holderName ?? null,
    },
  });
}

export async function listReservationPackages(reservationId: string) {
  const rows = await prisma.reservationPackageLine.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({ ...r, amount: decimalToNumber(r.amount) }));
}

export async function addReservationPackage(
  reservationId: string,
  input: { packageCode: string; packageName: string; amount: number },
) {
  const row = await prisma.reservationPackageLine.create({
    data: {
      reservationId,
      packageCode: input.packageCode,
      packageName: input.packageName,
      amount: toDecimal(input.amount),
    },
  });
  return { ...row, amount: decimalToNumber(row.amount) };
}

export async function listReservationTasks(reservationId: string) {
  return prisma.reservationTask.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addReservationTask(
  reservationId: string,
  input: { title: string; dueAt?: Date },
) {
  return prisma.reservationTask.create({
    data: {
      reservationId,
      title: input.title,
      dueAt: input.dueAt ?? null,
    },
  });
}

export async function getReservationFolioRouting(reservationId: string) {
  const folios = await prisma.folio.findMany({
    where: { reservationId },
    include: {
      charges: { include: { revenueCode: { include: { routingRule: true } } } },
    },
  });
  const rules = await prisma.folioRoutingRule.findMany({
    include: { revenueCode: true },
  });
  return { folios, rules };
}
