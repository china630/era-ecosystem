'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { DatePicker, PageHeader, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Disc = { id: string; roomId: string; roomNumber?: string; kind: string; notes: string | null; status: string };
type Esc = { roomNumber: string; kind: string; days: number };

export default function HkDiscrepancyPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Disc[]>([]);
  const [escalations, setEscalations] = useState<Esc[]>([]);

  const load = useCallback(async () => {
    const dRes = await fetch(`/api/housekeeping/discrepancy?date=${date}`);
    const dJson = await dRes.json();
    if (dRes.ok) {
      setRows(dJson.rows ?? []);
      setEscalations(dJson.escalations ?? []);
    } else showApiError(dJson, tc('loadError'));
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear(roomId: string) {
    const res = await fetch('/api/housekeeping/discrepancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, date, kind: null }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else showSuccess(tc('saved'));
    await load();
  }

  return (
    <>
      <PageHeader title={t('discrepancyTitle')} subtitle={`${t('skip')} · ${t('sleep')}`} />
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
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t('discrepancyEmpty')}</p> : null}
      {rows.length > 0 ? (
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
              {rows.map((row) => (
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
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
