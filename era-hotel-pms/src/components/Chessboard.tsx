'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import ReservationCardModal from '@/components/ReservationCardModal';
import RoomInfoModal from '@/components/RoomInfoModal';
import RoomRackView from '@/components/RoomRackView';
import { StatusMessage } from '@/components/layout/AppShell';
import { computeRackDisplayState } from '@/lib/room-rack-display';
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
  checkInDate?: string;
  checkOutDate?: string;
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

export default function Chessboard() {
  const { can } = useAuth();
  const t = useTranslations('chessboard');
  const tCommon = useTranslations('common');
  const tRoom = useTranslations('roomStatus');

  const roomStatusLabel = (status: RoomStatus) => tRoom(status);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [selected, setSelected] = useState<Room | null>(null);
  const [assignRoomId, setAssignRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revenueCodes, setRevenueCodes] = useState<{ id: string; code: string }[]>([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
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

  async function relocateToRoom(reservationId: string, toRoomId: string) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: toRoomId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tCommon('actionFailed'));
      setMessage(t('relocated'));
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tCommon('actionError'));
    } finally {
      setBusy(false);
    }
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

  function openReservationCard(reservationId?: string | null) {
    setEditReservationId(reservationId ?? null);
    setBookingModalOpen(true);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <StatusMessage>{message}</StatusMessage>

      {arrivals.length > 0 && (
        <section className="mb-4 rounded-xl border border-[#D5DADF] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('arrivalsTitle')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {arrivals
              .filter((a) => !a.room && a.status === 'CONFIRMED')
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-[#2980B9] hover:underline"
                    onClick={() => openReservationCard(a.id)}
                  >
                    {a.guest.fullName} — {a.roomType.code}
                  </button>
                  <select
                    className={MODAL_INPUT_CLASS}
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
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => assignToRoom(a.id, assignRoomId)}
                  >
                    {t('assign')}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <RoomRackView
        rooms={
          loading
            ? []
            : rooms.map((room) => ({
                ...room,
                rackDisplayState: computeRackDisplayState(room),
              }))
        }
        selectedId={selected?.id ?? null}
        onSelect={(rackRoom) => {
          const full = rooms.find((r) => r.id === rackRoom.id);
          if (full) setSelected(full);
        }}
        onQuickBook={
          can(PERMISSIONS.RESERVATIONS_WRITE)
            ? (rackRoom) => {
                const full = rooms.find((r) => r.id === rackRoom.id);
                openReservationCard(null);
                if (full) setSelected(full);
              }
            : undefined
        }
        onRelocate={
          can(PERMISSIONS.RESERVATIONS_WRITE)
            ? (reservationId, toRoomId) => relocateToRoom(reservationId, toRoomId)
            : undefined
        }
        loading={loading}
      />

      <RoomInfoModal
        room={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        busy={busy}
        canFolioRead={can(PERMISSIONS.FOLIO_READ)}
        canCheckIn={can(PERMISSIONS.RESERVATIONS_CHECKIN)}
        canCheckOut={can(PERMISSIONS.RESERVATIONS_CHECKOUT)}
        canCharge={can(PERMISSIONS.FOLIO_CHARGE)}
        foodCodeId={foodCode?.id}
        onCheckIn={(id) => runAction(`/api/reservations/${id}/check-in`)}
        onCheckOut={(id) => runAction(`/api/reservations/${id}/check-out`)}
        onAddCharge={(id, revenueCodeId) =>
          runAction(`/api/reservations/${id}/extras`, 'POST', {
            revenueCodeId,
            amount: 25,
            qty: 1,
            description: t('quickPosting'),
          })
        }
        onSetStatus={setRoomStatus}
        onOpenReservation={(id) => {
          setSelected(null);
          openReservationCard(id);
        }}
      />

      <ReservationCardModal
        open={bookingModalOpen}
        reservationId={editReservationId}
        onClose={() => {
          setBookingModalOpen(false);
          setEditReservationId(null);
          void load();
        }}
      />
    </div>
  );
}
