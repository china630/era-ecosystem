'use client';

import { useTranslations } from 'next-intl';
import { FieldTextarea } from '@era/satellite-kit/ui';
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
    <div className="space-y-4">
      {RESERVATION_NOTE_TYPES.map((nt) => (
        <FieldTextarea
          key={nt}
          label={t(`noteType.${nt}`)}
          rows={2}
          value={notes[nt] ?? ''}
          onChange={(e) => onNotes({ ...notes, [nt]: e.target.value })}
        />
      ))}
    </div>
  );
}
