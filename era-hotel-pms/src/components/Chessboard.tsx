'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import NewBookingModal from '@/components/NewBookingModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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
  AVAILABLE: 'border-[#2980B9]/40 bg-[#F8FAFC]',
  CLEAN: 'border-[#2980B9]/30 bg-white',
  INSPECTED: 'border-[#34495E]/30 bg-[#F1F5F9]',
  OCCUPIED: 'border-amber-400/60 bg-amber-50',
  DIRTY: 'border-rose-400/60 bg-rose-50',
  OOO: 'border-orange-400/60 bg-orange-50',
  OOS: 'border-[#D5DADF] bg-[#EBEDF0]',
  MAINTENANCE: 'border-[#7F8C8D]/40 bg-[#F1F5F9]',
};

export default function Chessboard() {
  const { can } = useAuth();
  const t = useTranslations('chessboard');
  const tMeta = useTranslations('meta');
  const tCommon = useTranslations('common');
  const tRoom = useTranslations('roomStatus');
  const tRes = useTranslations('reservationStatus');
  const tBooking = useTranslations('booking');

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

  return (
    <AppShell maxWidthClass="max-w-6xl">
      <PageHeader
        title={tMeta('title')}
        subtitle={t('subtitle')}
        actions={
          can(PERMISSIONS.RESERVATIONS_WRITE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setBookingModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {tBooking('createBooking')}
            </button>
          ) : undefined
        }
      />

      <StatusMessage>{message}</StatusMessage>

      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('hkHint')}</p>

      {arrivals.length > 0 && (
        <PageSection className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('arrivalsTitle')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {arrivals
              .filter((a) => !a.room && a.status === 'CONFIRMED')
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {a.guest.fullName} — {a.roomType.code}
                  </span>
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
        </PageSection>
      )}

      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('loadingRooms')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelected(room)}
              className={`rounded-2xl border-2 p-4 text-left transition hover:ring-2 hover:ring-[#2980B9]/30 ${statusStyles[room.status]} ${selected?.id === room.id ? 'ring-2 ring-[#2980B9]' : ''}`}
            >
              <div className="text-lg font-bold text-[#34495E]">{room.roomNumber}</div>
              <div className="text-[13px] text-[#7F8C8D]">
                {room.roomType.code} · {t('floor', { floor: room.floor })}
              </div>
              <div className="mt-2 text-[13px] font-medium text-[#34495E]">{roomStatusLabel(room.status)}</div>
              {room.reservations[0] && (
                <div className="mt-2 truncate text-[13px] text-[#7F8C8D]">
                  {room.reservations[0].guest.fullName} ({tRes(room.reservations[0].status)})
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PageSection className="mt-6">
          <h2 className="text-lg font-semibold text-[#34495E]">{t('roomTitle', { number: selected.roomNumber })}</h2>
          <p className="text-[13px] text-[#7F8C8D]">
            {selected.roomType.name} · {roomStatusLabel(selected.status)}
          </p>

          {activeReservation ? (
            <div className="mt-4 space-y-2 text-[13px] text-[#34495E]">
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
                <Link href={`/folio/${activeReservation.id}`} className="text-[#2980B9] hover:underline">
                  {t('openFolio')}
                </Link>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {activeReservation.status === 'CONFIRMED' && can(PERMISSIONS.RESERVATIONS_CHECKIN) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(`/api/reservations/${activeReservation.id}/check-in`)}
                    className={PRIMARY_BUTTON_CLASS}
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
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        {t('addCharge')}
                      </button>
                    )}
                    {can(PERMISSIONS.RESERVATIONS_CHECKOUT) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(`/api/reservations/${activeReservation.id}/check-out`)}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        {t('checkOut')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[#7F8C8D]">{t('noReservation')}</p>
          )}

          <div className="mt-6 border-t border-[#D5DADF] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[#7F8C8D]">{t('housekeeping')}</p>
            <div className="flex flex-wrap gap-2">
              {(['CLEAN', 'INSPECTED', 'DIRTY', 'AVAILABLE', 'OOO'] as RoomStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setRoomStatus(s)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {roomStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </PageSection>
      )}

      <NewBookingModal
        open={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          void load();
        }}
      />
    </AppShell>
  );
}
