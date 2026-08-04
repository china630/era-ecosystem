'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FieldTextarea } from '@era/satellite-kit/ui';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';
import { useHotelLookupOptions } from '@/lib/hotel-lookups';

export function ReservationCardNotesTab({
  notes,
  onNotes,
}: {
  notes: Record<string, string>;
  onNotes: (notes: Record<string, string>) => void;
}) {
  const t = useTranslations('reservationCard');
  const { byKind } = useHotelLookupOptions(['NOTE_TYPE']);
  const rows = useMemo(() => {
    const fromCatalog = byKind.NOTE_TYPE ?? [];
    if (fromCatalog.length > 0) return fromCatalog;
    return RESERVATION_NOTE_TYPES.map((code) => ({ value: code, label: code }));
  }, [byKind.NOTE_TYPE]);

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const key = `noteType.${row.value}`;
        let label = row.label;
        try {
          const translated = t(key as 'noteType.GENERAL_NOTE');
          if (translated && translated !== key) label = translated;
        } catch {
          /* keep catalog / code label */
        }
        return (
          <FieldTextarea
            key={row.value}
            label={label}
            rows={2}
            value={notes[row.value] ?? ''}
            onChange={(e) => onNotes({ ...notes, [row.value]: e.target.value })}
          />
        );
      })}
    </div>
  );
}
