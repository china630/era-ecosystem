'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { CatalogField, DatePicker, PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Row = {
  id: string;
  housekeeper: { name: string };
  pair: { floorLow: number; floorHigh: number };
};

export default function HkRotationPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Row[]>([]);
  const [warn, setWarn] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/rotation?date=${date}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    setRows(Array.isArray(json) ? json : json.assigned ?? []);
  }, [date, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rotate() {
    const res = await fetch('/api/housekeeping/rotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, shiftKind: 'E' }),
    });
    const json = await res.json();
    if (!res.ok) showApiError(json, t('title'));
    else setWarn(Boolean(json.warning));
    await load();
  }

  async function swap() {
    if (!a || !b || a === b) return;
    const res = await fetch('/api/housekeeping/rotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIdA: a, rowIdB: b }),
    });
    if (!res.ok) showApiError(await res.json(), t('title'));
    else showSuccess(tc('saved'));
    await load();
  }

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = `${row.pair.floorLow}–${row.pair.floorHigh}`;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  const people = rows.map((r) => ({
    value: r.id,
    label: `${r.housekeeper.name} · ${r.pair.floorLow}–${r.pair.floorHigh}`,
  }));

  return (
    <>
      <PageHeader
        title={t('rotationTitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void rotate()}>
            {t('rotateToday')}
          </button>
        }
      />
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
      {warn ? <p className="mb-2 text-sm text-amber-800">{t('pairsLeftover')}</p> : null}
      {rows.length === 0 ? <p className="mb-4 text-sm text-[#7F8C8D]">{t('rotationEmpty')}</p> : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([label, list]) => (
          <section key={label} className="rounded border border-[#D5DADF] bg-white p-3">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {t('floor')} {label}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {list.map((r) => (
                <li key={r.id}>{r.housekeeper.name}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {rows.length > 1 ? (
        <div className="grid max-w-lg gap-2">
          <CatalogField kind="ENTITY_REF" label={t('swapA')} value={a} onChange={(v) => setA(String(v))} options={people} />
          <CatalogField kind="ENTITY_REF" label={t('swapB')} value={b} onChange={(v) => setB(String(v))} options={people} />
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!a || !b || a === b} onClick={() => void swap()}>
            {t('swapPairs')}
          </button>
        </div>
      ) : null}
    </>
  );
}
