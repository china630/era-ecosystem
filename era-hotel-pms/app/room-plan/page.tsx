'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import RoomPlanGrid from '@/components/RoomPlanGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface ReservationBar {
  id: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  guest: { fullName: string };
  roomType: { code: string };
  totalAmount?: number;
}

interface RoomPlanData {
  from: string;
  days: number;
  rooms: {
    id: string;
    roomNumber: string;
    floor: number;
    status: string;
    roomType: { code: string };
  }[];
  reservations: ReservationBar[];
  unassigned: ReservationBar[];
}

export default function RoomPlanPage() {
  const { can } = useAuth();
  const t = useTranslations('roomPlan');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');
  const [days, setDays] = useState(14);
  const [data, setData] = useState<RoomPlanData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/room-plan?days=${days}`);
    const json = await res.json();
    if (res.ok) setData(json);
    else setMsg(json.error ?? t('failedLoad'));
  }, [days, t]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = data?.reservations.find((r) => r.id === selectedId)
    ?? data?.unassigned.find((r) => r.id === selectedId);

  async function extendNights(n: number) {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const checkOut = new Date(selected.checkOutDate);
      checkOut.setDate(checkOut.getDate() + n);
      const res = await fetch(`/api/reservations/${selected.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkOutDate: checkOut.toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('updateFailed'));
      setMsg(t('extendTo', { date: checkOut.toISOString().slice(0, 10) }));
      setSelectedId(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('updateError'));
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <div className="px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermissionRoomPlan')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <AppNav />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-slate-400">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 text-sm">
          {[14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded px-3 py-1 ${days === d ? 'bg-sky-700' : 'border border-slate-600'}`}
            >
              {t('days', { count: d })}
            </button>
          ))}
        </div>
      </header>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      {selected && can(PERMISSIONS.RESERVATIONS_WRITE) && (
        <aside className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">
          <span>
            <strong>{selected.guest.fullName}</strong> — {tRes(selected.status as 'CONFIRMED')} ·{' '}
            {selected.checkInDate.slice(0, 10)} → {selected.checkOutDate.slice(0, 10)}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => extendNights(1)}
            className="rounded bg-sky-700 px-2 py-1 text-xs disabled:opacity-50"
          >
            {t('plusOneNight')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => extendNights(2)}
            className="rounded bg-sky-700 px-2 py-1 text-xs disabled:opacity-50"
          >
            {t('plusTwoNights')}
          </button>
          <Link href={`/folio/${selected.id}`} className="text-sky-400 hover:underline">
            {t('folio')}
          </Link>
        </aside>
      )}

      {data?.unassigned && data.unassigned.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="text-amber-200/90">{t('unassigned')}</span>
          {data.unassigned.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={`rounded border px-2 py-0.5 ${selectedId === u.id ? 'border-sky-500 bg-sky-950' : 'border-slate-600'}`}
            >
              {u.guest.fullName}
            </button>
          ))}
        </div>
      )}

      {data && (
        <RoomPlanGrid
          fromIso={data.from}
          days={data.days}
          rooms={data.rooms as never}
          reservations={data.reservations as never}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}
