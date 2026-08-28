import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { uploadSatelliteAttachment } from '@era/satellite-kit';

export async function listReservationAttachments(reservationId: string) {
  return prisma.reservationAttachment.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createReservationAttachment(
  reservationId: string,
  input: {
    fileName: string;
    mimeType?: string;
    fileSize?: number;
    kind?: string;
    storageKey?: string;
  },
) {
  return prisma.reservationAttachment.create({
    data: {
      reservationId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      kind: input.kind ?? 'OTHER',
      storageKey: input.storageKey,
    },
  });
}

/** Upload buffer to org-scoped storage and create PASSPORT_SCAN (or OTHER) row. */
export async function uploadReservationAttachmentFile(input: {
  reservationId: string;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  kind?: 'PASSPORT_SCAN' | 'OTHER';
}) {
  const uploaded = await uploadSatelliteAttachment({
    organizationId: requestOrganizationId(),
    fileName: input.fileName,
    buffer: input.buffer,
    contentType: input.mimeType,
  });
  return createReservationAttachment(input.reservationId, {
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.buffer.length,
    kind: input.kind ?? 'OTHER',
    storageKey: uploaded.key,
  });
}

export async function deleteReservationAttachment(id: string) {
  return prisma.reservationAttachment.delete({ where: { id } });
}
