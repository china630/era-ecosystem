'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, PageHeader, PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type Cell = {
  id: string;
  workDate: string;
  kind: string;
  housekeeper: { id: string; name: string; egBalance: number; department: string };
};

const KINDS = ['E', 'L', 'N', 'OFF', 'EG', 'CUSTOM'];
const DEPTS = ['ROOMS', 'PUBLIC_AREA', 'LAUNDRY'];

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
  const [order, setOrder] = useState<string[]>([]);
  const [calendarNote, setCalendarNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/roster?weekStart=${weekStart}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    const next = Array.isArray(json?.cells) ? json.cells : [];
    setCells(next);
    const ids: string[] = [];
    for (const c of next as Cell[]) {
      if (!ids.includes(c.housekeeper.id)) ids.push(c.housekeeper.id);
    }
    setOrder(ids);
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

  async function persistOrder(next: string[]) {
    setOrder(next);
    await fetch('/api/housekeeping/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next }),
    });
  }

  async function moveDept(housekeeperId: string, department: string) {
    await fetch('/api/housekeeping/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ housekeeperId, department }),
    });
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
        {order.map((hid) => {
          const row = byPerson.get(hid);
          if (!row?.[0]) return null;
          return (
            <div
              key={hid}
              className="rounded border p-3"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', hid)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain');
                const next = order.filter((id) => id !== from);
                const idx = next.indexOf(hid);
                next.splice(idx, 0, from);
                void persistOrder(next);
              }}
            >
              <p className="mb-2 text-sm font-medium">
                {row[0].housekeeper.name} · ƏG {row[0].housekeeper.egBalance}
              </p>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t('department')}
                value={row[0].housekeeper.department}
                onChange={(v) => void moveDept(hid, String(v))}
                options={DEPTS.map((d) => ({ value: d, label: d }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {row
                  .sort((a, b) => a.workDate.localeCompare(b.workDate))
                  .map((c) => (
                    <CatalogField
                      key={c.id}
                      kind="CLOSED_SMALL"
                      label={c.workDate.slice(0, 10)}
                      value={c.kind}
                      onChange={(v) => void setKind(c.id, String(v))}
                      options={KINDS.map((k) => ({ value: k, label: k }))}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
