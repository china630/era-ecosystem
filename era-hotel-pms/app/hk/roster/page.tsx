'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { addHotelDays, hotelDateKey, parseHotelNoon } from '@/lib/hotel-calendar';
import { CatalogField, DatePicker, PageHeader, PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type Cell = {
  id: string;
  workDate: string;
  kind: string;
  housekeeper: { id: string; name: string; egBalance: number; department: string };
};

const KINDS = ['E', 'L', 'N', 'OFF', 'EG'] as const;

export default function HkRosterPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [weekStart, setWeekStart] = useState(() => {
    const today = hotelDateKey();
    const dow = parseHotelNoon(today).getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    return addHotelDays(today, diff);
  });
  const [cells, setCells] = useState<Cell[]>([]);
  const [todayPair, setTodayPair] = useState<Record<string, string>>({});
  const [calendarNote, setCalendarNote] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addHotelDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/roster?weekStart=${weekStart}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    const next = Array.isArray(json?.cells) ? (json.cells as Cell[]) : [];
    setCells(next);
    const today = hotelDateKey();
    const rot = await fetch(`/api/housekeeping/rotation?date=${today}`);
    if (rot.ok) {
      const list = await rot.json();
      const map: Record<string, string> = {};
      for (const r of Array.isArray(list) ? list : []) {
        map[r.housekeeper?.id ?? r.housekeeperId] = `${r.pair.floorLow}–${r.pair.floorHigh}`;
      }
      setTodayPair(map);
    }
  }, [weekStart, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function propose() {
    const res = await fetch('/api/housekeeping/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart }),
    });
    if (!res.ok) showApiError(await res.json(), t('title'));
    await load();
  }

  async function setKind(cellId: string, kind: string) {
    const res = await fetch('/api/housekeeping/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellId, kind }),
    });
    if (!res.ok) showApiError(await res.json(), t('title'));
    await load();
  }

  async function accrue() {
    const res = await fetch('/api/housekeeping/eg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: weekStart }),
    });
    const json = await res.json();
    if (!res.ok) showApiError(json, t('title'));
    else if (json.calendarUnavailable) setCalendarNote(t('calendarUnavailable'));
    await load();
  }

  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; egBalance: number }>();
    for (const c of cells) {
      if (!map.has(c.housekeeper.id)) {
        map.set(c.housekeeper.id, {
          id: c.housekeeper.id,
          name: c.housekeeper.name,
          egBalance: c.housekeeper.egBalance,
        });
      }
    }
    return [...map.values()];
  }, [cells]);

  function cellFor(personId: string, day: string) {
    return cells.find((c) => c.housekeeper.id === personId && String(c.workDate).slice(0, 10) === day);
  }

  return (
    <>
      <PageHeader
        title={t('rosterTitle')}
        subtitle={t('rosterHint')}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void propose()}>
              {t('proposeWeek')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void accrue()}>
              {t('accrueEg')}
            </button>
          </div>
        }
      />
      {calendarNote ? <p className="mb-2 text-sm text-amber-800">{calendarNote}</p> : null}
      <div className="mb-4 max-w-xs">
        <DatePicker
          label={t('weekStart')}
          value={weekStart}
          onChange={(next) => {
            if (!next) return;
            const dow = parseHotelNoon(next).getUTCDay();
            const diff = dow === 0 ? -6 : 1 - dow;
            setWeekStart(addHotelDays(next, diff));
          }}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
      </div>
      {people.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t('rosterEmpty')}</p> : null}
      {people.length > 0 ? (
        <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                <th className="px-2 py-2">{t('colMaid')}</th>
                <th className="px-2 py-2">{t('floor')}</th>
                {days.map((d) => (
                  <th key={d} className="px-2 py-2">
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-[#ECF0F1] align-top">
                  <td className="px-2 py-2 font-medium">{p.name}</td>
                  <td className="px-2 py-2">{todayPair[p.id] ?? '—'}</td>
                  {days.map((d) => {
                    const cell = cellFor(p.id, d);
                    return (
                      <td key={d} className="px-1 py-1">
                        {cell ? (
                          <CatalogField
                            kind="CLOSED_SMALL"
                            label={d}
                            value={cell.kind === 'CUSTOM' ? 'OFF' : cell.kind}
                            onChange={(v) => void setKind(cell.id, String(v))}
                            options={KINDS.map((k) => ({ value: k, label: k === 'EG' ? 'ƏG' : k }))}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
