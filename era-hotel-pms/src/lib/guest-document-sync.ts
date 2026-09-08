import type { Prisma } from '@prisma/client';
import { GUEST_FIN_DOC_TYPES, GUEST_PASSPORT_DOC_TYPES } from '@/lib/guest-list-identity';

type DocClient = Pick<
  Prisma.TransactionClient,
  'guestDocument'
>;

async function upsertGuestDoc(
  tx: DocClient,
  guestId: string,
  docType: string,
  docNumber: string,
  isPrimary: boolean,
) {
  const existing = await tx.guestDocument.findFirst({
    where: { guestId, docType },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await tx.guestDocument.update({
      where: { id: existing.id },
      data: { docNumber, isPrimary },
    });
    return;
  }
  await tx.guestDocument.create({
    data: { guestId, docType, docNumber, isPrimary },
  });
}

/** Persist FIN / passport on GuestDocument for list search and MDM backfill. */
export async function syncGuestIdentityDocuments(
  tx: DocClient,
  guestId: string,
  input: {
    nationalIdFin?: string | null;
    passportNumber?: string | null;
    nationality?: string;
  },
) {
  const fin = input.nationalIdFin?.trim();
  const passport = input.passportNumber?.trim();
  if (fin) {
    await upsertGuestDoc(tx, guestId, 'ID_CARD', fin, !passport);
  }
  if (passport) {
    await upsertGuestDoc(tx, guestId, 'PASSPORT', passport, true);
  }
}

export { GUEST_FIN_DOC_TYPES, GUEST_PASSPORT_DOC_TYPES };
