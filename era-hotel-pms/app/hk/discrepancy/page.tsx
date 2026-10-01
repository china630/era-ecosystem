'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { CatalogField, DatePicker, PageHeader, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Disc = { id: string; roomId: string; kind: string; notes: string | null; status: string };
type Esc = { roomNumber: string; kind: string; days: number };
type Room = { id: string; roomNumber: string; status?: string };

export default function HkDiscrepancyPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Disc[]>([]);
  const [escalations, setEscalations] = useState<Esc[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

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

  const byRoom = useMemo(() => {
    const map = new Map<string, Disc>();
    for (const row of rows) map.set(row.roomId, row);
    return map;
  }, [rows]);

  async function setKind(roomId: string, kind: string) {
    const res = await fetch('/api/housekeeping/discrepancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, date, kind: kind === 'SKIP' || kind === 'SLEEP' ? kind : null }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else showSuccess(tc('saved'));
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('discrepancyTitle')}
        subtitle={`${t('skip')} · ${t('sleep')}`}
      />
      {escalations.length > 0 ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {escalations.map((e) => (
            <p key={`${e.roomNumber}-${e.kind}`}>
              {e.kind === 'SO' ? t('soEscalation') : t('dndEscalation')} · {e.roomNumber} · {e.days}
            </p>
          ))}
        </div>
      ) : null}
      <div className="mb-4 max-w-xs">
        <DatePicker
          label={tc('datePlaceholder')}
          value={date}
          onChange={(next) => {
            if (next) setDate(next);
          }}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
      </div>
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              <th className="px-3 py-2">{t('colRoom')}</th>
              <th className="px-3 py-2">{t('discrepancyKind')}</th>
              <th className="px-3 py-2">{t('outcome')}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const hit = byRoom.get(room.id);
              return (
                <tr key={room.id} className="border-b border-[#ECF0F1]">
                  <td className="px-3 py-2 font-medium">{room.roomNumber}</td>
                  <td className="px-3 py-2">
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t('discrepancyKind')}
                      value={hit?.kind ?? ''}
                      onChange={(v) => void setKind(room.id, String(v))}
                      options={[
                        { value: 'SKIP', label: t('skip') },
                        { value: 'SLEEP', label: t('sleep') },
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2 text-[#7F8C8D]">{hit?.status ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
