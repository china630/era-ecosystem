import { prisma } from '@/lib/prisma';

export async function listReservationAttachments(reservationId: string) {
  return prisma.reservationAttachment.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createReservationAttachment(
  reservationId: string,
  input: { fileName: string; mimeType?: string; fileSize?: number },
) {
  return prisma.reservationAttachment.create({
    data: { reservationId, ...input },
  });
}

export async function deleteReservationAttachment(id: string) {
  return prisma.reservationAttachment.delete({ where: { id } });
}
