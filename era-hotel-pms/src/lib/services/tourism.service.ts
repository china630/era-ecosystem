import { prisma } from '@/lib/prisma';
import { getPropertyCode } from '@/lib/services/hotel.service';
import { getTourismAdapter } from '@/lib/compliance/tourism-adapter';

async function buildPayload(reservationId: string) {
  const res = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { guest: true, room: { include: { roomType: true } }, roomType: true },
  });
  const propertyCode = await getPropertyCode();
  return {
    fullName: res.guest.fullName,
    passportNumber: res.guest.passportNumber,
    checkInDate: res.checkInDate.toISOString().slice(0, 10),
    checkOutDate: res.checkOutDate.toISOString().slice(0, 10),
    roomNumber: res.room?.roomNumber ?? null,
    roomTypeCode: res.room?.roomType?.code ?? res.roomType.code,
    propertyCode,
  };
}

export async function submitTourismCheckIn(reservationId: string) {
  if (process.env.TOURISM_REGISTRY_ENABLED === 'false') return null;
  const payload = await buildPayload(reservationId);
  const submission = await prisma.tourismSubmission.create({
    data: {
      reservationId,
      eventKind: 'CHECK_IN',
      status: 'PENDING',
      payloadJson: JSON.stringify(payload),
    },
  });
  const adapter = getTourismAdapter();
  const result = await adapter.submitCheckIn(payload);
  return prisma.tourismSubmission.update({
    where: { id: submission.id },
    data: {
      status: result.ok ? 'SENT' : 'FAILED',
      errorMessage: result.error ?? null,
      sentAt: result.ok ? new Date() : null,
    },
  });
}

export async function submitTourismCheckOut(reservationId: string) {
  if (process.env.TOURISM_REGISTRY_ENABLED === 'false') return null;
  const payload = await buildPayload(reservationId);
  const submission = await prisma.tourismSubmission.create({
    data: {
      reservationId,
      eventKind: 'CHECK_OUT',
      status: 'PENDING',
      payloadJson: JSON.stringify(payload),
    },
  });
  const adapter = getTourismAdapter();
  const result = await adapter.submitCheckOut(payload);
  return prisma.tourismSubmission.update({
    where: { id: submission.id },
    data: {
      status: result.ok ? 'SENT' : 'FAILED',
      errorMessage: result.error ?? null,
      sentAt: result.ok ? new Date() : null,
    },
  });
}

export async function retryTourismSubmission(id: string) {
  const sub = await prisma.tourismSubmission.findUniqueOrThrow({ where: { id } });
  const payload = JSON.parse(sub.payloadJson);
  const adapter = getTourismAdapter();
  const result =
    sub.eventKind === 'CHECK_OUT'
      ? await adapter.submitCheckOut(payload)
      : await adapter.submitCheckIn(payload);
  return prisma.tourismSubmission.update({
    where: { id },
    data: {
      status: result.ok ? 'SENT' : 'FAILED',
      errorMessage: result.error ?? null,
      sentAt: result.ok ? new Date() : null,
    },
  });
}

export async function listFailedTourismSubmissions() {
  return prisma.tourismSubmission.findMany({
    where: { status: 'FAILED' },
    include: { reservation: { include: { guest: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
