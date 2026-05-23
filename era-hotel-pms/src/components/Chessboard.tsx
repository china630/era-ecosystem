'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

interface Guest {
  id: string;
  fullName: string;
}

interface Reservation {
  id: string;
  status: ReservationStatus;
  guest: Guest;
  totalAmount: number;
}

interface Room {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  floor: number;
  roomType: { code: string; name: string };
  reservations: Reservation[];
}

interface Arrival {
  id: string;
  guest: Guest;
  roomType: { code: string };
  room: { roomNumber: string } | null;
  status: ReservationStatus;
}

const statusStyles: Record<RoomStatus, string> = {
  AVAILABLE: 'border-emerald-500/60 bg-emerald-950/40',
  CLEAN: 'border-emerald-400/50 bg-emerald-950/30',
  INSPECTED: 'border-teal-500/60 bg-teal-950/40',
  OCCUPIED: 'border-amber-500/60 bg-amber-950/40',
  DIRTY: 'border-rose-500/60 bg-rose-950/40',
  OOO: 'border-orange-600/60 bg-orange-950/40',
  OOS: 'border-slate-600/60 bg-slate-800/60',
  MAINTENANCE: 'border-slate-500/60 bg-slate-800/60',
};

export default function Chessboard() {
  const { can } = useAuth();
  const t = useTranslations('chessboard');
  const tMeta = useTranslations('meta');
  const tCommon = useTranslations('common');
  const tRoom = useTranslations('roomStatus');
  const tRes = useTranslations('reservationStatus');

  const roomStatusLabel = (status: RoomStatus) => tRoom(status);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [selected, setSelected] = useState<Room | null>(null);
  const [assignRoomId, setAssignRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revenueCodes, setRevenueCodes] = useState<{ id: string; code: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, arrivalsRes, revRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/reservations/arrivals'),
        fetch('/api/master/revenue-codes'),
      ]);
      const roomsData = await roomsRes.json();
      const arrivalsData = await arrivalsRes.json();
      const revData = await revRes.json();
      if (!roomsRes.ok) throw new Error(roomsData.error ?? t('failedLoadRooms'));
      setRooms(roomsData);
      setArrivals(arrivalsRes.ok ? arrivalsData : []);
      setRevenueCodes(revRes.ok ? revData : []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tCommon('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, tCommon]);

  useEffect(() => {
    load();
  }, [load]);

  const activeReservation = selected?.reservations?.[0];
  const foodCode = revenueCodes.find((r) => r.code === 'FOOD');

  async function runAction(path: string, method = 'POST', body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tCommon('actionFailed'));
      setMessage(
        path.includes('check-out')
          ? t('checkedOut', {
              status: data.dispatch?.dispatched ? t('eventSent') : t('eventQueued'),
            })
          : tCommon('success'),
      );
      await load();
      if (!path.includes('assign')) setSelected(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tCommon('actionError'));
    } finally {
      setBusy(false);
    }
  }

  async function assignToRoom(reservationId: string, roomId: string) {
    await runAction(`/api/reservations/${reservationId}/assign`, 'POST', { roomId });
  }

  async function setRoomStatus(status: RoomStatus) {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/rooms/${selected.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tCommon('updateFailed'));
      setMessage(
        t('roomStatusUpdated', { number: selected.roomNumber, status: roomStatusLabel(status) }),
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tCommon('updateError'));
    } finally {
      setBusy(false);
    }
  }

  const assignableRooms = selected
    ? rooms.filter(
        (r) =>
          r.roomType.code === selected.roomType.code &&
          ['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(r.status),
      )
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AppNav />
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{tMeta('title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('subtitle')}</p>
      </header>

      {message && (
        <p className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">
          {message}
        </p>
      )}

      <p className="mb-4 text-xs text-slate-500">
        {t('hkHint')}
      </p>

      {arrivals.length > 0 && (
        <section className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
            {t('arrivalsTitle')}
          </h2>
          <ul className="space-y-2 text-sm">
            {arrivals
              .filter((a) => !a.room && a.status === 'CONFIRMED')
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {a.guest.fullName} — {a.roomType.code}
                  </span>
                  <select
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                  >
                    <option value="">{t('assignRoom')}</option>
                    {rooms
                      .filter(
                        (r) =>
                          r.roomType.code === a.roomType.code &&
                          ['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(r.status),
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roomNumber}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !assignRoomId}
                    className="rounded bg-sky-700 px-2 py-1 text-xs disabled:opacity-50"
                    onClick={() => assignToRoom(a.id, assignRoomId)}
                  >
                    {t('assign')}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="text-slate-400">{t('loadingRooms')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelected(room)}
              className={`rounded-xl border-2 p-4 text-left transition hover:ring-2 hover:ring-slate-500 ${statusStyles[room.status]} ${selected?.id === room.id ? 'ring-2 ring-white' : ''}`}
            >
              <div className="text-lg font-bold">{room.roomNumber}</div>
              <div className="text-xs text-slate-400">
                {room.roomType.code} · {t('floor', { floor: room.floor })}
              </div>
              <div className="mt-2 text-xs font-medium">{roomStatusLabel(room.status)}</div>
              {room.reservations[0] && (
                <div className="mt-2 truncate text-xs text-slate-300">
                  {room.reservations[0].guest.fullName} ({tRes(room.reservations[0].status)})
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <aside className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-medium">{t('roomTitle', { number: selected.roomNumber })}</h2>
          <p className="text-sm text-slate-400">
            {selected.roomType.name} · {roomStatusLabel(selected.status)}
          </p>

          {activeReservation ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                {t('guest')}: {activeReservation.guest.fullName}
              </p>
              <p>
                {t('reservation')}: {tRes(activeReservation.status)}
              </p>
              <p>
                {t('balance')}: {activeReservation.totalAmount} AZN
              </p>
              {can(PERMISSIONS.FOLIO_READ) && (
                <Link
                  href={`/folio/${activeReservation.id}`}
                  className="text-sm text-sky-400 hover:underline"
                >
                  {t('openFolio')}
                </Link>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {activeReservation.status === 'CONFIRMED' && can(PERMISSIONS.RESERVATIONS_CHECKIN) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(`/api/reservations/${activeReservation.id}/check-in`)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t('checkIn')}
                  </button>
                )}
                {activeReservation.status === 'IN_HOUSE' && (
                  <>
                    {foodCode && can(PERMISSIONS.FOLIO_CHARGE) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(`/api/reservations/${activeReservation.id}/extras`, 'POST', {
                            revenueCodeId: foodCode.id,
                            amount: 25,
                            qty: 1,
                            description: t('quickPosting'),
                          })
                        }
                        className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm hover:bg-slate-500 disabled:opacity-50"
                      >
                        {t('addCharge')}
                      </button>
                    )}
                    {can(PERMISSIONS.RESERVATIONS_CHECKOUT) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(`/api/reservations/${activeReservation.id}/check-out`)
                      }
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
                    >
                      {t('checkOut')}
                    </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{t('noReservation')}</p>
          )}

          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t('housekeeping')}</p>
            <div className="flex flex-wrap gap-2">
              {(['CLEAN', 'INSPECTED', 'DIRTY', 'AVAILABLE', 'OOO'] as RoomStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setRoomStatus(s)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {roomStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
