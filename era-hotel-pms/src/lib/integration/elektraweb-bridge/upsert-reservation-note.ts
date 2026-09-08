import { prisma } from '@/lib/prisma';
import { mapNoteType } from '@/lib/import/adapters/reservation-notes.adapter';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import { num, str } from '@/lib/integration/elektraweb-bridge/normalize';
import type { UpsertResult } from '@/lib/integration/elektraweb-bridge/upsert-guest';

const SKIP_NOTE_TYPES = /^(channel|tour operator notes)$/i;

/**
 * Long-format Reservation Notes grid (`QA_EASYPMS_NOTES`):
 * one row per (RESID, NOTETYPE) with NOTES text.
 */
export function planElektrawebNotesRow(row: Record<string, unknown>): {
  skip?: string;
  externalRef?: string;
  noteType?: string;
  text?: string;
} {
  const externalRef = str(row.RESID) ?? str(row.ID);
  if (!externalRef) return { skip: 'missing-resid' };

  const typeRaw = str(row.NOTETYPE) ?? str(row.NOTE_TYPE) ?? '';
  if (typeRaw && SKIP_NOTE_TYPES.test(typeRaw)) {
    return { skip: 'channel-noise', externalRef };
  }

  const text = str(row.NOTES) ?? str(row.NOTE);
  if (!text) return { skip: 'empty-text', externalRef };

  const noteType = mapNoteType(typeRaw);
  if (!noteType) return { skip: 'unknown-type', externalRef };

  return { externalRef, noteType, text };
}

export async function upsertReservationNoteFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult & { reservationId?: string }> {
  const hotelId = num(row.HOTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  const plan = planElektrawebNotesRow(row);
  if (plan.skip || !plan.externalRef || !plan.noteType || !plan.text) {
    return { action: 'skipped', key: plan.externalRef ?? '?' };
  }

  const reservation = await prisma.reservation.findFirst({
    where: { externalRef: plan.externalRef },
    select: { id: true },
  });
  if (!reservation) {
    return { action: 'skipped', key: plan.externalRef };
  }

  const existing = await prisma.reservationNote.findUnique({
    where: {
      reservationId_noteType: {
        reservationId: reservation.id,
        noteType: plan.noteType,
      },
    },
    select: { id: true },
  });

  await prisma.reservationNote.upsert({
    where: {
      reservationId_noteType: {
        reservationId: reservation.id,
        noteType: plan.noteType,
      },
    },
    create: {
      reservationId: reservation.id,
      noteType: plan.noteType,
      text: plan.text,
    },
    update: { text: plan.text },
  });

  return {
    action: existing ? 'updated' : 'created',
    key: plan.externalRef,
    reservationId: reservation.id,
  };
}
