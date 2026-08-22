'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Disc = { id: string; roomId: string; kind: string; notes: string | null; status: string };
type Esc = { roomNumber: string; kind: string; days: number };

export default function HkDiscrepancyPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Disc[]>([]);
  const [escalations, setEscalations] = useState<Esc[]>([]);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('SKIP');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string }>>([]);

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
    if (rRes.ok) {
      const list = await rRes.json();
      setRooms(Array.isArray(list) ? list : []);
    }
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const res = await fetch('/api/housekeeping/discrepancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, date, kind }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else showSuccess(tc('saved'));
    await load();
  }

  return (
    <>
      <PageHeader title={t('discrepancyTitle')} />
      {escalations.length > 0 ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {escalations.map((e) => (
            <p key={`${e.roomNumber}-${e.kind}`}>
              {e.kind === 'SO' ? t('soEscalation') : t('dndEscalation')} · {e.roomNumber} · {e.days}
            </p>
          ))}
        </div>
      ) : null}
      <input type="date" className="mb-4 border px-2 py-1" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="mb-4 grid max-w-md gap-2">
        <CatalogField
          kind="ENTITY_REF"
          label={t('roomSelect')}
          value={roomId}
          onChange={(v) => setRoomId(String(v))}
          options={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('discrepancyKind')}
          value={kind}
          onChange={(v) => setKind(String(v))}
          options={[
            { value: 'SKIP', label: t('skip') },
            { value: 'SLEEP', label: t('sleep') },
          ]}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void save()}>
          {tc('save')}
        </button>
      </div>
      <ul className="text-sm">
        {rows.map((r) => (
          <li key={r.id}>
            {r.kind} · {r.roomId.slice(0, 8)} · {r.status}
          </li>
        ))}
      </ul>
    </>
  );
}
