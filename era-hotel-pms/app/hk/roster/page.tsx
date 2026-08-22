'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type Cell = {
  id: string;
  workDate: string;
  kind: string;
  housekeeper: { id: string; name: string; egBalance: number; department: string };
};

export default function HkRosterPage() {
  const t = useTranslations('housekeeping');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  });
  const [cells, setCells] = useState<Cell[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/roster?weekStart=${weekStart}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    setCells(Array.isArray(json?.cells) ? json.cells : []);
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

  const byPerson = new Map<string, Cell[]>();
  for (const c of cells) {
    const id = c.housekeeper.id;
    byPerson.set(id, [...(byPerson.get(id) ?? []), c]);
  }

  return (
    <>
      <PageHeader
        title={t('rosterTitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void propose()}>
            {t('proposeWeek')}
          </button>
        }
      />
      <label className="mb-4 block text-sm">
        {t('weekStart')}
        <input
          type="date"
          className="ml-2 border px-2 py-1"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </label>
      <div className="space-y-4">
        {[...byPerson.values()].map((row) => (
          <div key={row[0]?.housekeeper.id} className="rounded border p-3">
            <p className="mb-2 text-sm font-medium">
              {row[0]?.housekeeper.name} · ƏG {row[0]?.housekeeper.egBalance}
            </p>
            <div className="flex flex-wrap gap-2">
              {row
                .sort((a, b) => a.workDate.localeCompare(b.workDate))
                .map((c) => (
                  <label key={c.id} className="text-xs">
                    {c.workDate.slice(0, 10)}
                    <select
                      className={`${SECONDARY_BUTTON_CLASS} ml-1`}
                      value={c.kind}
                      onChange={(e) => void setKind(c.id, e.target.value)}
                    >
                      {['E', 'L', 'N', 'OFF', 'EG', 'CUSTOM'].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
