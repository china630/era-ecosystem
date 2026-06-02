'use client';

import { useTranslations } from 'next-intl';
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from '@era/satellite-kit/ui';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';

export function ReservationCardNotesTab({
  notes,
  onNotes,
}: {
  notes: Record<string, string>;
  onNotes: (notes: Record<string, string>) => void;
}) {
  const t = useTranslations('reservationCard');

  return (
    <div className="space-y-2">
      {RESERVATION_NOTE_TYPES.map((nt) => (
        <div key={nt} className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <label className={`${MODAL_FIELD_LABEL_CLASS} pt-2`}>{t(`noteType.${nt}`)}</label>
          <textarea
            className={`${MODAL_INPUT_CLASS} min-h-[2rem]`}
            rows={2}
            value={notes[nt] ?? ''}
            onChange={(e) => onNotes({ ...notes, [nt]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
