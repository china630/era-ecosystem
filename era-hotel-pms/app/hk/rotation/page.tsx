'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { CatalogField, DatePicker, PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Row = {
  id: string;
  housekeeper: { name: string };
  pair: { floorLow: number; floorHigh: number };
};

const DEFAULT_PAIRS: Array<{ floorLow: number; floorHigh: number }> = [
  { floorLow: 2, floorHigh: 3 },
  { floorLow: 4, floorHigh: 5 },
  { floorLow: 6, floorHigh: 7 },
  { floorLow: 8, floorHigh: 9 },
  { floorLow: 10, floorHigh: 11 },
];

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
    for (const pair of DEFAULT_PAIRS) {
      map.set(`${pair.floorLow}–${pair.floorHigh}`, []);
    }
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
        subtitle={t('rotationHint')}
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
      {rows.length === 0 ? (
        <p className="mb-4 text-sm text-[#7F8C8D]">
          {t('rotationEmpty')}{' '}
          <Link href="/hk/maids" className="text-[#2980B9] underline">
            {t('maidsLink')}
          </Link>
          {' · '}
          <Link href="/hk/roster" className="text-[#2980B9] underline">
            {t('rosterLink')}
          </Link>
        </p>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([label, list]) => (
          <section key={label} className="rounded border border-[#D5DADF] bg-white p-3">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {t('floor')} {label}
            </h2>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-[#7F8C8D]">{t('rotationSlotEmpty')}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {list.map((r) => (
                  <li key={r.id}>{r.housekeeper.name}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="grid max-w-lg gap-2">
        <CatalogField
          kind="ENTITY_REF"
          label={t('swapA')}
          value={a}
          onChange={(v) => setA(String(v))}
          options={people}
          emptyLabel={t('rotationSwapNeed')}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t('swapB')}
          value={b}
          onChange={(v) => setB(String(v))}
          options={people}
          emptyLabel={t('rotationSwapNeed')}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={rows.length < 2 || !a || !b || a === b}
          onClick={() => void swap()}
        >
          {t('swapPairs')}
        </button>
      </div>
    </>
  );
}
