'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, PageHeader, PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type HkTask = {
  id: string;
  roomId: string;
  housekeeperId?: string | null;
  jobType?: string;
  status: string;
  room?: { roomNumber: string; floor?: number };
};

type Rot = { housekeeperId: string; housekeeper: { id: string; name: string }; pair: { floorLow: number; floorHigh: number } };

const OUTCOMES = ['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO'] as const;

export default function HkMobilePage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [tasks, setTasks] = useState<HkTask[]>([]);
  const [rotation, setRotation] = useState<Rot[]>([]);
  const [maidId, setMaidId] = useState('');

  const load = useCallback(async () => {
    const date = new Date().toISOString().slice(0, 10);
    const [tRes, rRes] = await Promise.all([
      fetch('/api/housekeeping/tasks'),
      fetch(`/api/housekeeping/rotation?date=${date}`),
    ]);
    const tJson = await tRes.json();
    if (tRes.ok) setTasks(Array.isArray(tJson) ? tJson : (tJson.tasks ?? []));
    else showApiError(tJson, tc('loadError'));
    const rJson = await rRes.json();
    if (rRes.ok) setRotation(Array.isArray(rJson) ? rJson : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => {
    if (!maidId) return tasks;
    const rot = rotation.find((r) => r.housekeeperId === maidId || r.housekeeper.id === maidId);
    if (!rot) return tasks.filter((x) => x.housekeeperId === maidId);
    return tasks.filter((x) => {
      const f = x.room?.floor;
      if (typeof f !== 'number') return x.housekeeperId === maidId;
      return f >= rot.pair.floorLow && f <= rot.pair.floorHigh;
    });
  }, [tasks, rotation, maidId]);

  async function complete(id: string) {
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    await load();
  }

  async function outcome(id: string, code: string) {
    const res = await fetch('/api/housekeeping/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id, outcome: code }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    await load();
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <PageHeader title={t('mobileTitle')} />
      <CatalogField
        kind="ENTITY_REF"
        label={t('myFloors')}
        value={maidId}
        onChange={(v) => setMaidId(String(v))}
        options={rotation.map((r) => ({
          value: r.housekeeperId ?? r.housekeeper.id,
          label: `${r.housekeeper.name} ${r.pair.floorLow}–${r.pair.floorHigh}`,
        }))}
      />
      <ul className="mt-4 space-y-2">
        {mine.map((task) => (
          <li key={task.id} className="rounded border p-3">
            <span className="text-sm">
              {task.room?.roomNumber ?? task.roomId} · {task.jobType} · {task.status}
            </span>
            {task.status !== 'DONE' && (
              <div className="mt-2">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t('outcome')}
                  value=""
                  onChange={(v) => void outcome(task.id, String(v))}
                  options={OUTCOMES.map((o) => ({
                    value: o,
                    label: o === 'REFUSED' ? t('refused') : o,
                  }))}
                />
                <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-2`} onClick={() => void complete(task.id)}>
                  {t('completeClean')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
