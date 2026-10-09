'use client';

import { useTranslations } from 'next-intl';

export type ReservationNoteItem = {
  noteType: string;
  text: string;
};

/** Bold note title, then the text. Hidden when every note is empty. */
export function ReservationNoteLine({
  notes,
  className = 'm-0 rounded-md border border-[#D5DADF] bg-[#F8F9FA] px-2.5 py-1 text-[12px] leading-5 text-[#34495E]',
}: {
  notes: ReservationNoteItem[];
  className?: string;
}) {
  const t = useTranslations('reservationCard');
  const filled = notes.filter((note) => (note.text ?? '').trim().length > 0);
  if (filled.length === 0) return null;

  return (
    <p className={className} data-testid="reservation-note-strip">
      {filled.map((note, index) => {
        const key = `noteType.${note.noteType}` as 'noteType.GENERAL_NOTE';
        let title = note.noteType;
        try {
          const translated = t(key);
          if (
            translated &&
            translated !== key &&
            translated !== `reservationCard.${key}`
          ) {
            title = translated;
          }
        } catch {
          title = note.noteType;
        }
        return (
          <span key={`${note.noteType}-${index}`}>
            {index > 0 ? ' ' : null}
            <strong className="font-semibold">{title}</strong> {(note.text ?? '').trim()}
          </span>
        );
      })}
    </p>
  );
}
