'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type Row = {
  id: string;
  housekeeper: { name: string };
  pair: { floorLow: number; floorHigh: number };
};

export default function HkRotationPage() {
  const t = useTranslations('housekeeping');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/rotation?date=${date}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    setRows(Array.isArray(json) ? json : []);
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
    if (!res.ok) showApiError(await res.json(), t('title'));
    await load();
  }

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
      <input type="date" className="mb-4 border px-2 py-1" value={date} onChange={(e) => setDate(e.target.value)} />
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id}>
            {r.housekeeper.name}: {r.pair.floorLow}–{r.pair.floorHigh}
          </li>
        ))}
      </ul>
    </>
  );
}
