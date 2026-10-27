'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Disc = { id: string; roomId: string; roomNumber?: string; kind: string; notes: string | null; status: string };
type Esc = { roomNumber: string; kind: string; days: number };
type RoomOpt = { id: string; roomNumber: string };

export default function HkDiscrepancyPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Disc[]>([]);
  const [escalations, setEscalations] = useState<Esc[]>([]);
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState<'SKIP' | 'SLEEP'>('SKIP');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dRes, rRes] = await Promise.all([
      fetch(`/api/housekeeping/discrepancy?date=${date}`),
      fetch('/api/rooms'),
    ]);
    const dJson = await dRes.json();
    if (dRes.ok) {
      setRows(dJson.rows ?? []);
      setEscalations(dJson.escalations ?? []);
    } else showApiError(dJson, tc('loadError'));
    const rJson = await rRes.json().catch(() => null);
    if (rRes.ok) {
      const list = (Array.isArray(rJson) ? rJson : rJson?.data ?? []) as Array<{
        id: string;
        roomNumber: string;
      }>;
      setRooms(
        list
          .map((r) => ({ id: r.id, roomNumber: r.roomNumber }))
          .sort((a, b) =>
            String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }),
          ),
      );
    }
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear(roomIdToClear: string) {
    const res = await fetch('/api/housekeeping/discrepancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: roomIdToClear, date, kind: null }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else showSuccess(tc('saved'));
    await load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/discrepancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          date,
          kind,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        showApiError(await res.json(), tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setOpen(false);
      setRoomId('');
      setNotes('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('discrepancyTitle')}
        subtitle={t('discrepancyHint')}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setRoomId('');
              setKind('SKIP');
              setNotes('');
              setOpen(true);
            }}
          >
            + {t('discrepancyCreate')}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setDate(hotelDateKey())}
      >
        <DatePicker
          label={tc('datePlaceholder')}
          value={date}
          onChange={(next) => {
            if (next) setDate(next);
          }}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
      </EraListFilterBar>
      {escalations.length > 0 ? (
        <div className="mb-3 space-y-1 text-sm">
          {escalations.map((e) => (
            <p key={`${e.roomNumber}-${e.kind}`} className="rounded border border-amber-300 bg-amber-50 px-2 py-1">
              {e.kind === 'SO' ? t('soEscalation') : t('dndEscalation')} · {e.roomNumber} · {e.days}
            </p>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              <th className="px-3 py-2">{t('colRoom')}</th>
              <th className="px-3 py-2">{t('discrepancyKind')}</th>
              <th className="px-3 py-2">{t('outcome')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b border-[#ECF0F1]">
                <td className="px-3 py-3 text-[#7F8C8D]" colSpan={4}>
                  {t('discrepancyEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#ECF0F1]">
                  <td className="px-3 py-2 font-medium">{row.roomNumber || row.roomId}</td>
                  <td className="px-3 py-2">{row.kind === 'SKIP' ? t('skip') : t('sleep')}</td>
                  <td className="px-3 py-2 text-[#7F8C8D]">{row.status}</td>
                  <td className="px-3 py-2">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void clear(row.roomId)}>
                      {tc('remove')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <EraModal
        open={open}
        title={t('discrepancyCreateTitle')}
        onClose={() => setOpen(false)}
        footer={
          <EraModalFooter
            formId="disc-create"
            onCancel={() => setOpen(false)}
            busy={busy}
            submitDisabled={!roomId}
            submitLabel={t('discrepancyCreate')}
          />
        }
      >
        <form id="disc-create" onSubmit={(e) => void create(e)} className="space-y-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t('colRoom')}
            value={roomId}
            onChange={(v) => setRoomId(String(v))}
            options={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
            emptyLabel={t('roomSelect')}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('discrepancyKind')}
            value={kind}
            onChange={(v) => setKind(String(v) === 'SLEEP' ? 'SLEEP' : 'SKIP')}
            options={[
              { value: 'SKIP', label: t('skip') },
              { value: 'SLEEP', label: t('sleep') },
            ]}
          />
          <Field
            label={tc('notes')}
            preset="longText"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </form>
      </EraModal>
    </>
  );
}
