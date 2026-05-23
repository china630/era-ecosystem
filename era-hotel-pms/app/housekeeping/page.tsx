'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Task {
  id: string;
  status: string;
  notes: string | null;
  room: { id: string; roomNumber: string; status: string; roomType: { code: string } };
}

interface Room {
  id: string;
  roomNumber: string;
  status: string;
  roomType: { code: string };
}

export default function HousekeepingPage() {
  const { can } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const tRoom = useTranslations('roomStatus');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [oooRoomId, setOooRoomId] = useState('');
  const [oooDays, setOooDays] = useState('3');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tRes, rRes] = await Promise.all([
      fetch('/api/housekeeping/tasks'),
      fetch('/api/rooms'),
    ]);
    if (tRes.ok) setTasks(await tRes.json());
    if (rRes.ok) setRooms(await rRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function completeTask(taskId: string) {
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    const status = data.room?.status as string | undefined;
    setMsg(
      res.ok
        ? t('taskDone', { status: status ? tRoom(status as 'CLEAN') : status ?? tc('dash') })
        : data.error,
    );
    await load();
  }

  async function markInspected(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INSPECTED' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('roomInspected', { room: data.roomNumber }) : data.error);
    await load();
  }

  async function setOoo(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: oooRoomId, days: parseInt(oooDays, 10), notes: 'OOO from HK' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('roomOoo', { room: data.roomNumber }) : data.error);
    await load();
  }

  if (!can(PERMISSIONS.HOUSEKEEPING_MANAGE) && !can(PERMISSIONS.ROOMS_STATUS)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermissionHousekeeping')}</p>
      </div>
    );
  }

  const dirtyRooms = rooms.filter((r) => r.status === 'DIRTY');
  const cleanRooms = rooms.filter((r) => r.status === 'CLEAN');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <p className="mb-4 text-sm text-slate-400">{t('hint')}</p>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('pendingTasks')}</h2>
        <ul className="space-y-2 text-sm">
          {tasks
            .filter((task) => task.status !== 'DONE')
            .map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {task.room.roomNumber} ({task.room.roomType.code}) — {task.status}
                </span>
                {can(PERMISSIONS.HOUSEKEEPING_MANAGE) && (
                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs"
                  >
                    {t('completeClean')}
                  </button>
                )}
              </li>
            ))}
          {tasks.filter((task) => task.status !== 'DONE').length === 0 && (
            <li className="text-slate-500">{t('noOpenTasks')}</li>
          )}
        </ul>
      </section>

      {can(PERMISSIONS.ROOMS_STATUS) && cleanRooms.length > 0 && (
        <section className="mb-8 rounded-xl border border-slate-700 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('markInspected')}</h2>
          <ul className="flex flex-wrap gap-2">
            {cleanRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => markInspected(r.id)}
                className="rounded border border-teal-600 px-3 py-1 text-xs hover:bg-teal-950"
              >
                {t('roomToInspected', { room: r.roomNumber })}
              </button>
            ))}
          </ul>
        </section>
      )}

      {dirtyRooms.length > 0 && (
        <section className="mb-8 text-sm text-amber-200/80">
          {t('dirtyWithoutTask')} {dirtyRooms.map((r) => r.roomNumber).join(', ')}
        </section>
      )}

      {can(PERMISSIONS.HOUSEKEEPING_MANAGE) && (
        <form onSubmit={setOoo} className="rounded-xl border border-slate-700 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('outOfOrder')}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
              value={oooRoomId}
              onChange={(e) => setOooRoomId(e.target.value)}
              required
            >
              <option value="">{t('roomSelect')}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} ({tRoom(r.status as 'DIRTY')})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
              value={oooDays}
              onChange={(e) => setOooDays(e.target.value)}
            />
            <button type="submit" className="rounded bg-orange-700 px-3 py-1 text-sm">
              {t('setOoo')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
