'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import ReservationCardModal from '@/components/ReservationCardModal';
import RoomInfoModal from '@/components/RoomInfoModal';
import RoomRackView from '@/components/RoomRackView';
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
  const router = useRouter();
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
  const [busy, setBusy] = useState(false);
  const [revenueCodes, setRevenueCodes] = useState<{ id: string; code: string }[]>([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [checkoutPrompt, setCheckoutPrompt] = useState<{
    id: string;
    guest: string;
    balance: number;
  } | null>(null);
  const [checkoutLeaveOnCl, setCheckoutLeaveOnCl] = useState(true);
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
      if (!roomsRes.ok) {
        showApiError(roomsData, t('failedLoadRooms'));
        return;
      }
      setRooms(roomsData);
      setArrivals(arrivalsRes.ok ? arrivalsData : []);
      setRevenueCodes(revRes.ok ? revData : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tCommon('loadError') });
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
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tCommon('actionFailed'));
        return;
      }
      showSuccess(
        path.includes('check-out')
          ? t('checkedOut', {
              status: data.dispatch?.dispatched ? t('eventSent') : t('eventQueued'),
            })
          : tCommon('success'),
      );
      await load();
      if (!path.includes('assign')) setSelected(null);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tCommon('actionError') });
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
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: toRoomId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tCommon('actionFailed'));
        return;
      }
      showSuccess(t('relocated'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tCommon('actionError') });
    } finally {
      setBusy(false);
    }
  }

  async function setRoomStatus(status: RoomStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${selected.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tCommon('updateFailed'));
        return;
      }
      showSuccess(
        t('roomStatusUpdated', { number: selected.roomNumber, status: roomStatusLabel(status) }),
      );
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tCommon('updateError') });
    } finally {
      setBusy(false);
    }
  }

  function openReservationCard(reservationId?: string | null) {
    if (reservationId) {
      router.push(`/reservations/${reservationId}`);
      return;
    }
    setEditReservationId(null);
    setBookingModalOpen(true);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                      .filter((r) => r.roomType.code === a.roomType.code)
                      .map((r) => {
                        const assignable = ['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(r.status);
                        return (
                          <option key={r.id} value={r.id} disabled={!assignable}>
                            {r.roomNumber}
                            {assignable
                              ? ` (${roomStatusLabel(r.status)})`
                              : ` — ${roomStatusLabel(r.status)} (${t('dirtyNotAssignable')})`}
                          </option>
                        );
                      })}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !assignRoomId}
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => assignToRoom(a.id, assignRoomId)}
                  >
                    {t('assign')}
                  </button>
                  <span className="text-[11px] text-[#7F8C8D]">{t('assignableOnlyHint')}</span>
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
        onCheckOut={(id) => {
          const res = selected?.reservations.find((r) => r.id === id);
          setCheckoutLeaveOnCl(true);
          setCheckoutPrompt({
            id,
            guest: res?.guest.fullName ?? '',
            balance: Number(res?.totalAmount ?? 0),
          });
        }}
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

      <EraModal
        open={Boolean(checkoutPrompt)}
        title={t('checkoutModalTitle')}
        onClose={() => setCheckoutPrompt(null)}
        footer={
          <EraModalFooter
            onCancel={() => setCheckoutPrompt(null)}
            busy={busy}
            onSubmit={() => {
              if (!checkoutPrompt) return;
              const id = checkoutPrompt.id;
              setCheckoutPrompt(null);
              void runAction(`/api/reservations/${id}/check-out`, 'POST', {
                transferToCityLedger: checkoutLeaveOnCl,
              });
            }}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px] text-[#34495E]">
          {checkoutPrompt?.guest ? <p className="m-0 font-medium">{checkoutPrompt.guest}</p> : null}
          <p className="m-0">
            {t('checkoutBalancePreview', {
              amount: (checkoutPrompt?.balance ?? 0).toFixed(2),
            })}
          </p>
          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="chessCheckoutCl"
                checked={checkoutLeaveOnCl}
                onChange={() => setCheckoutLeaveOnCl(true)}
              />
              <span>
                <span className="font-medium">{t('leaveOnCityLedger')}</span>
                <span className="mt-0.5 block text-[12px] text-[#7F8C8D]">
                  {t('leaveOnCityLedgerHint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="chessCheckoutCl"
                checked={!checkoutLeaveOnCl}
                onChange={() => setCheckoutLeaveOnCl(false)}
              />
              <span>
                <span className="font-medium">{t('payGuestFirst')}</span>
                <span className="mt-0.5 block text-[12px] text-[#7F8C8D]">
                  {t('payGuestFirstHint')}
                </span>
              </span>
            </label>
          </div>
        </div>
      </EraModal>

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
