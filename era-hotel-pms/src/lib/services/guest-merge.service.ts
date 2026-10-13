import type { Prisma } from '@prisma/client';
import { mergePersonRecords } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { guestComposedFullName } from '@/lib/guest-identity.shared';
import { syncGuestNameToOpenStays } from '@/lib/services/guest-name-sync.service';

export class GuestDedupNeedsPersonMerge extends Error {
  readonly needsPersonMerge = true;

  constructor() {
    super('These cards are two people in the registry');
    this.name = 'GuestDedupNeedsPersonMerge';
  }
}

export function dedupPair(a: string, b: string): { guestIdLow: string; guestIdHigh: string } {
  return a < b
    ? { guestIdLow: a, guestIdHigh: b }
    : { guestIdLow: b, guestIdHigh: a };
}

const STRING_FILL = [
  'firstName',
  'middleName',
  'lastName',
  'sex',
  'phone',
  'email',
  'birthPlace',
  'occupation',
  'title',
  'visaType',
  'visaNumber',
] as const;

type GuestMove = {
  updateMany: (args: { where: { guestId: string }; data: { guestId: string } }) => Promise<unknown>;
};

async function retarget(delegate: GuestMove, from: string, to: string) {
  await delegate.updateMany({ where: { guestId: from }, data: { guestId: to } });
}

async function foldGuest(survivorId: string, duplicateId: string) {
  await prisma.$transaction(async (tx) => {
    const survivor = await tx.guest.findUnique({ where: { id: survivorId } });
    const duplicate = await tx.guest.findUnique({ where: { id: duplicateId } });
    if (!survivor || !duplicate) throw new Error('Guest not found');

    const patch: Prisma.GuestUpdateInput = {};
    for (const key of STRING_FILL) {
      const current = survivor[key];
      const incoming = duplicate[key];
      if ((current == null || String(current).trim() === '') && incoming && String(incoming).trim()) {
        patch[key] = incoming;
      }
    }
    if (!survivor.birthDate && duplicate.birthDate) patch.birthDate = duplicate.birthDate;
    if (!survivor.visaExpiry && duplicate.visaExpiry) patch.visaExpiry = duplicate.visaExpiry;
    if (!survivor.globalPersonId && duplicate.globalPersonId) {
      patch.globalPersonId = duplicate.globalPersonId;
    }
    const nextFirst = (patch.firstName as string | undefined) ?? survivor.firstName;
    const nextMiddle = (patch.middleName as string | undefined) ?? survivor.middleName;
    const nextLast = (patch.lastName as string | undefined) ?? survivor.lastName;
    if (patch.firstName || patch.middleName || patch.lastName) {
      patch.fullName =
        guestComposedFullName({
          firstName: nextFirst,
          middleName: nextMiddle,
          lastName: nextLast,
          fullName: survivor.fullName,
        }) || survivor.fullName;
    }
    if (!survivor.externalRef && duplicate.externalRef) {
      await tx.guest.update({ where: { id: duplicateId }, data: { externalRef: null } });
      patch.externalRef = duplicate.externalRef;
    }
    if (Object.keys(patch).length > 0) {
      await tx.guest.update({ where: { id: survivorId }, data: patch });
    }

    await tx.reservation.updateMany({
      where: { guestId: duplicateId },
      data: { guestId: survivorId },
    });
    await tx.reservation.updateMany({
      where: { bookerGuestId: duplicateId },
      data: { bookerGuestId: survivorId },
    });

    const dupPax = await tx.reservationGuest.findMany({ where: { guestId: duplicateId } });
    for (const pax of dupPax) {
      const sibling = await tx.reservationGuest.findFirst({
        where: { reservationId: pax.reservationId, guestId: survivorId, id: { not: pax.id } },
      });
      if (!sibling) {
        await tx.reservationGuest.update({
          where: { id: pax.id },
          data: {
            guestId: survivorId,
            firstName: nextFirst,
            middleName: nextMiddle,
            lastName: nextLast,
          },
        });
        continue;
      }
      const dupFolio = await tx.folio.findFirst({ where: { reservationGuestId: pax.id } });
      const siblingFolio = await tx.folio.findFirst({
        where: { reservationGuestId: sibling.id },
      });
      if (dupFolio && !siblingFolio) {
        await tx.folio.update({
          where: { id: dupFolio.id },
          data: { reservationGuestId: sibling.id },
        });
      }
      if (dupFolio && siblingFolio) {
        await tx.reservationGuest.update({
          where: { id: pax.id },
          data: { guestId: survivorId },
        });
      } else {
        await tx.reservationGuest.delete({ where: { id: pax.id } });
      }
    }

    await retarget(tx.migrationRegistration, duplicateId, survivorId);
    await retarget(tx.guestArchiveFile, duplicateId, survivorId);
    await retarget(tx.guestPreference, duplicateId, survivorId);
    await retarget(tx.guestAllergen, duplicateId, survivorId);
    await retarget(tx.guestSpecialDate, duplicateId, survivorId);
    await retarget(tx.guestFavoriteRoom, duplicateId, survivorId);
    await retarget(tx.guestComment, duplicateId, survivorId);
    await retarget(tx.guestSurvey, duplicateId, survivorId);
    await retarget(tx.guestIncident, duplicateId, survivorId);
    await retarget(tx.guestCommunication, duplicateId, survivorId);
    await retarget(tx.guestContactLog, duplicateId, survivorId);
    await retarget(tx.guestLoyaltyCard, duplicateId, survivorId);
    await retarget(tx.guestLoyaltyPointEntry, duplicateId, survivorId);
    await retarget(tx.guestTimeShareAgreement, duplicateId, survivorId);
    await retarget(tx.guestNote, duplicateId, survivorId);
    await retarget(tx.guestTask, duplicateId, survivorId);
    await retarget(tx.guestDocument, duplicateId, survivorId);
    await retarget(tx.guestContact, duplicateId, survivorId);
    await retarget(tx.guestAddress, duplicateId, survivorId);
    await retarget(tx.medicalAlert, duplicateId, survivorId);
    await retarget(tx.conciergeOrder, duplicateId, survivorId);
    await tx.dispatchRequest.updateMany({
      where: { guestId: duplicateId },
      data: { guestId: survivorId },
    });
    await tx.lostFoundItem.updateMany({
      where: { guestId: duplicateId },
      data: { guestId: survivorId },
    });
    await tx.tourBooking.updateMany({
      where: { guestId: duplicateId },
      data: { guestId: survivorId },
    });
    await tx.salesContract.updateMany({
      where: { companyGuestId: duplicateId },
      data: { companyGuestId: survivorId },
    });
    await tx.banquetEvent.updateMany({
      where: { companyGuestId: duplicateId },
      data: { companyGuestId: survivorId },
    });

    const keptTags = new Set(
      (
        await tx.guestTag.findMany({ where: { guestId: survivorId }, select: { name: true } })
      ).map((row: { name: string }) => row.name),
    );
    for (const tag of await tx.guestTag.findMany({ where: { guestId: duplicateId } })) {
      if (keptTags.has(tag.name)) await tx.guestTag.delete({ where: { id: tag.id } });
      else await tx.guestTag.update({ where: { id: tag.id }, data: { guestId: survivorId } });
    }

    await tx.guestFamily.updateMany({
      where: { relatedGuestId: duplicateId },
      data: { relatedGuestId: survivorId },
    });
    const keptFamily = new Set(
      (
        await tx.guestFamily.findMany({
          where: { guestId: survivorId },
          select: { relatedGuestId: true },
        })
      ).map((row: { relatedGuestId: string }) => row.relatedGuestId),
    );
    for (const row of await tx.guestFamily.findMany({ where: { guestId: duplicateId } })) {
      if (keptFamily.has(row.relatedGuestId) || row.relatedGuestId === survivorId) {
        await tx.guestFamily.delete({ where: { id: row.id } });
      } else {
        await tx.guestFamily.update({ where: { id: row.id }, data: { guestId: survivorId } });
      }
    }

    const survivorCrm = await tx.guestCrmExtension.findUnique({ where: { guestId: survivorId } });
    const duplicateCrm = await tx.guestCrmExtension.findUnique({ where: { guestId: duplicateId } });
    if (duplicateCrm && survivorCrm) {
      await tx.guestCrmExtension.delete({ where: { id: duplicateCrm.id } });
    } else if (duplicateCrm) {
      await tx.guestCrmExtension.update({
        where: { id: duplicateCrm.id },
        data: { guestId: survivorId },
      });
    }

    await tx.guestDedupDismissal.deleteMany({
      where: {
        OR: [
          { guestIdLow: duplicateId },
          { guestIdHigh: duplicateId },
          { guestIdLow: survivorId },
          { guestIdHigh: survivorId },
        ],
      },
    });
    await tx.guest.delete({ where: { id: duplicateId } });
  });
  await syncGuestNameToOpenStays(survivorId).catch((error) =>
    console.error('Name sync after guest merge failed', error),
  );
}

export async function mergeGuestCards(input: {
  survivorId: string;
  duplicateIds: string[];
  confirmPersonMerge?: boolean;
}) {
  const duplicateIds = [...new Set(input.duplicateIds.filter((id) => id && id !== input.survivorId))];
  if (duplicateIds.length === 0) throw new Error('Choose a card to keep');

  const survivor = await prisma.guest.findUnique({ where: { id: input.survivorId } });
  if (!survivor) throw new Error('Guest not found');
  const duplicates = await prisma.guest.findMany({ where: { id: { in: duplicateIds } } });
  if (duplicates.length !== duplicateIds.length) throw new Error('Guest not found');

  const personClash = duplicates.some(
    (row) =>
      Boolean(survivor.globalPersonId) &&
      Boolean(row.globalPersonId) &&
      row.globalPersonId !== survivor.globalPersonId,
  );
  if (personClash && !input.confirmPersonMerge) throw new GuestDedupNeedsPersonMerge();

  let canonicalPersonId = survivor.globalPersonId;
  if (input.confirmPersonMerge) {
    for (const row of duplicates) {
      if (!row.globalPersonId || !canonicalPersonId || row.globalPersonId === canonicalPersonId) {
        if (!canonicalPersonId && row.globalPersonId) canonicalPersonId = row.globalPersonId;
        continue;
      }
      const merged = await mergePersonRecords(row.globalPersonId, canonicalPersonId);
      if (!merged.globalPersonId) throw new Error('MDM merge failed');
      canonicalPersonId = merged.globalPersonId;
    }
    if (canonicalPersonId && canonicalPersonId !== survivor.globalPersonId) {
      await prisma.guest.update({
        where: { id: survivor.id },
        data: { globalPersonId: canonicalPersonId },
      });
    }
  }

  for (const row of duplicates) {
    await foldGuest(survivor.id, row.id);
  }
  return { survivorId: survivor.id, merged: duplicates.length };
}
