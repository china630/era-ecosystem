import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';

export async function createAlert(input: {
  guestId: string;
  reservationId?: string;
  temperature?: number;
  message: string;
}) {
  return prisma.medicalAlert.create({ data: input });
}

export async function listAlerts(resolved = false) {
  return prisma.medicalAlert.findMany({
    where: { resolved },
    include: { guest: true, reservation: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createOrder(reservationId: string, orderType: string) {
  return prisma.medicalOrder.create({
    data: { reservationId, orderType, status: 'PENDING' },
  });
}

export async function addLabResult(
  orderId: string,
  input: { testName: string; resultValue: string; flag?: 'NORMAL' | 'HIGH' | 'LOW' },
) {
  const result = await prisma.labResult.create({
    data: { medicalOrderId: orderId, ...input },
  });
  await prisma.medicalOrder.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' },
  });
  return result;
}

export async function postProcedureToFolio(
  reservationId: string,
  input: { code: string; name: string; amount: number },
) {
  const medicalCode = await prisma.revenueCode.findUnique({ where: { code: 'MEDICAL' } });
  if (!medicalCode) throw new Error('Revenue code MEDICAL not configured');

  await prisma.medicalProcedure.create({
    data: { reservationId, code: input.code, name: input.name, amount: toDecimal(input.amount) },
  });

  return postCharge({
    reservationId,
    revenueCodeId: medicalCode.id,
    amount: input.amount,
    description: input.name,
  });
}
