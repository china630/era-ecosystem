'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  FieldTextarea,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
} from '@era/satellite-kit/ui';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';
import { useHotelLookupOptions } from '@/lib/hotel-lookups';

type NoteDept = 'all' | 'fo' | 'hk' | 'billing';

const DEPT_CODES: Record<Exclude<NoteDept, 'all'>, readonly string[]> = {
  fo: [
    'RES_NOTE',
    'CIN_NOTE',
    'COUT_NOTE',
    'GENERAL_NOTE',
    'CONFIRMATION',
    'CANCEL_NOTE',
    'ARRIVAL_POSTPONED',
    'DEPARTURE_EXTENDED',
    'SET_ARRIVAL_EARLY',
    'SET_DEPARTURE_EARLY',
  ],
  hk: ['ROOM_NOTE', 'EXTRA_REQ'],
  billing: ['PAYMENT_NOTE', 'INVOICE_NOTE', 'PRICE_NOTE'],
};

/** Categorized notes feed (HOT-BOOK-09) — NOTE_TYPE catalog, not N giant textareas. */
export function ReservationCardNotesTab({
  notes,
  onNotes,
}: {
  notes: Record<string, string>;
  onNotes: (notes: Record<string, string>) => void;
}) {
  const t = useTranslations('reservationCard');
  const { byKind } = useHotelLookupOptions(['NOTE_TYPE']);
  const [dept, setDept] = useState<NoteDept>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [addCode, setAddCode] = useState('');

  const catalog = useMemo(() => {
    const fromCatalog = byKind.NOTE_TYPE ?? [];
    if (fromCatalog.length > 0) return fromCatalog;
    return RESERVATION_NOTE_TYPES.map((code) => ({ value: code, label: code }));
  }, [byKind.NOTE_TYPE]);

  function labelFor(code: string, fallback: string) {
    const key = `noteType.${code}`;
    try {
      const translated = t(key as 'noteType.GENERAL_NOTE');
      if (translated && translated !== key) return translated;
    } catch {
      /* keep catalog / code label */
    }
    return fallback || code;
  }

  const visible = useMemo(() => {
    if (dept === 'all') return catalog;
    const allow = new Set(DEPT_CODES[dept]);
    return catalog.filter((row) => allow.has(row.value));
  }, [catalog, dept]);

  const filled = useMemo(
    () => visible.filter((row) => Boolean((notes[row.value] ?? '').trim())),
    [visible, notes],
  );
  const empty = useMemo(
    () => visible.filter((row) => !(notes[row.value] ?? '').trim()),
    [visible, notes],
  );

  const editingRow = useMemo(() => {
    if (!editing) return null;
    return catalog.find((row) => row.value === editing) ?? { value: editing, label: editing };
  }, [catalog, editing]);

  const editingIsEmpty = Boolean(editing && !(notes[editing] ?? '').trim());

  function startAdd() {
    const code = addCode || empty[0]?.value;
    if (!code) return;
    setEditing(code);
    setAddCode('');
  }

  return (
    <div className="space-y-3" data-testid="reservation-notes-tab">
      <div className={CHIP_GROUP_CLASS} role="tablist" aria-label={t('notesFilter')}>
        {(['all', 'fo', 'hk', 'billing'] as NoteDept[]).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={dept === d}
            className={dept === d ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            data-testid={`notes-dept-${d}`}
            onClick={() => setDept(d)}
          >
            {t(`notesDept.${d}`)}
          </button>
        ))}
      </div>

      <ul className="m-0 list-none space-y-2 p-0">
        {filled.map((row) => (
          <li key={row.value} className={SUBSECTION_SURFACE_CLASS}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[#34495E]">
                {labelFor(row.value, row.label)}
              </span>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} text-[11px]`}
                onClick={() => setEditing((v) => (v === row.value ? null : row.value))}
              >
                {editing === row.value ? t('notesCollapse') : t('notesEdit')}
              </button>
            </div>
            {editing === row.value ? (
              <FieldTextarea
                label=""
                rows={3}
                value={notes[row.value] ?? ''}
                onChange={(e) => onNotes({ ...notes, [row.value]: e.target.value })}
              />
            ) : (
              <p className="m-0 whitespace-pre-wrap text-[13px] text-[#34495E]">
                {notes[row.value]}
              </p>
            )}
          </li>
        ))}

        {editingRow && editingIsEmpty ? (
          <li className={SUBSECTION_SURFACE_CLASS} data-testid="notes-add-editor">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[#34495E]">
                {labelFor(editingRow.value, editingRow.label)}
              </span>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} text-[11px]`}
                onClick={() => setEditing(null)}
              >
                {t('notesCollapse')}
              </button>
            </div>
            <FieldTextarea
              label=""
              rows={3}
              autoFocus
              value={notes[editingRow.value] ?? ''}
              onChange={(e) => onNotes({ ...notes, [editingRow.value]: e.target.value })}
            />
          </li>
        ) : null}
      </ul>

      {empty.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2" data-testid="notes-add-picker">
          <label className={`flex min-w-[12rem] flex-1 flex-col gap-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
            {t('notesAddType')}
            <select
              className="rounded border border-[#D5DADF] bg-white px-2 py-1.5 text-[13px] text-[#34495E]"
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
            >
              <option value="">{t('notesPickType')}</option>
              {empty.map((row) => (
                <option key={row.value} value={row.value}>
                  {labelFor(row.value, row.label)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!addCode && empty.length === 0}
            onClick={startAdd}
          >
            {t('notesAdd')}
          </button>
        </div>
      ) : null}

      {filled.length === 0 && empty.length === 0 && !editingIsEmpty ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t('notesEmpty')}</p>
      ) : null}
    </div>
  );
}
