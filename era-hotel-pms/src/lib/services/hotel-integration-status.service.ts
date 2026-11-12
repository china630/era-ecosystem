import { prisma } from '@/lib/prisma';

export async function countActiveNonCrossSystemUsers() {
  return prisma.user.count({
    where: { status: 'ACTIVE', isCrossSystem: false },
  });
}

export async function applyFiscalGlPostedStatus(input: {
  fiscalDocumentId?: string;
  invoiceNumber?: string;
  glReference: string;
  glPostedAt?: Date;
}) {
  const doc = input.fiscalDocumentId
    ? await prisma.fiscalDocument.findUnique({ where: { id: input.fiscalDocumentId } })
    : input.invoiceNumber
      ? await prisma.fiscalDocument.findFirst({ where: { invoiceNumber: input.invoiceNumber } })
      : null;

  if (!doc) return null;

  return prisma.fiscalDocument.update({
    where: { id: doc.id },
    data: {
      glPostedAt: input.glPostedAt ?? new Date(),
      glReference: input.glReference,
      fiscalStatus: 'ACCEPTED',
    },
  });
}
