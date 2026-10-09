'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  LIST_PAGE_SHELL_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import ReservationCardModal from '@/components/ReservationCardModal';
import RoomInfoModal from '@/components/RoomInfoModal';
import RoomRackView from '@/components/RoomRackView';
import { computeRackDisplayState } from '@/lib/room-rack-display';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { operationalGapDetails, operationalGapLabelKey } from '@/lib/guest-stay-requirements';

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
  payStatus?: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NONE';
  folioBalance?: number;
  shareEligible?: boolean;
  shareGender?: string | null;
  shareBedIndex?: number | null;
  adults?: number;
}

interface Room {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  hkCondition?: 'DIRTY' | 'PICKUP' | 'CLEAN' | 'INSPECTED';
  inventoryStatus?: 'IN_SERVICE' | 'OOS' | 'OOO';
  floor: number;
  roomType: { code: string; name: string; adultCapacity?: number };
  maxBed?: number | null;
  sharePool?: { gender: string; occupied: number; capacity: number } | null;
  reservations: Reservation[];
}

interface Arrival {
  id: string;
  guest: Guest & { sex?: string | null };
  roomType: { code: string };
  room: { roomNumber: string } | null;
  status: ReservationStatus;
  shareEligible?: boolean;
  shareGender?: string | null;
  adults?: number;
  checkInDate?: string;
  checkOutDate?: string;
}

export default function Chessboard() {
  const { can } = useAuth();
  const t = useTranslations('chessboard');
  const tCard = useTranslations('reservationCard');
  const tCommon = useTranslations('common');
  const tRoom = useTranslations('roomStatus');

  const roomStatusLabel = (status: RoomStatus) => tRoom(status);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState(() => hotelDateKey(new Date()));
  const [filterDateTo, setFilterDateTo] = useState(() => hotelDateKey(new Date()));
  const [selected, setSelected] = useState<Room | null>(null);
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
  const [earlyCheckout, setEarlyCheckout] = useState<{
    applicable: boolean;
    unusedNights: number;
    unusedSellGross: number;
    vatWithheld: number;
    guestCashRefund: number;
  } | null>(null);
  const [unusedNightsRefundMethod, setUnusedNightsRefundMethod] = useState<'CASH' | 'CARD'>('CASH');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fromQ = encodeURIComponent(filterDateFrom);
      const toQ = encodeURIComponent(filterDateTo);
      const [roomsRes, arrivalsRes, revRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch(`/api/reservations/arrivals?dateFrom=${fromQ}&dateTo=${toQ}`),
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
  }, [t, tCommon, filterDateFrom, filterDateTo]);

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
        if (data?.code === 'BUSINESS_DATE_LAG') {
          showApiError({
            error: tCard('checkInBusinessDateLag', {
              businessDate: String(data.businessDate ?? ''),
              arrivalDate: String(data.arrivalDate ?? ''),
            }),
          });
          return;
        }
        if (data?.code === 'GUEST_CHECK_IN_INCOMPLETE') {
          showApiError({
            error: tCard('checkInBlocked', {
              details: operationalGapDetails(data.people, (gap) =>
                tCard(operationalGapLabelKey(gap)),
              ),
            }),
          });
          return;
        }
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

  async function relocateToRoom(
    reservationId: string,
    toRoomId: string,
    reasonCode: 'GUEST_REFUSED' | 'DID_NOT_OCCUPY' | 'HOTEL',
  ) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: toRoomId, compUpgrade: true, reasonCode }),
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
    setEditReservationId(reservationId ?? null);
    setBookingModalOpen(true);
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      {arrivals.some((a) => !a.room && a.status === 'CONFIRMED') ? (
        <div className="mb-2 flex shrink-0 flex-wrap gap-2 text-[13px]">
          <span className="text-amber-800">{t('unassigned')}</span>
          {arrivals
            .filter((a) => !a.room && a.status === 'CONFIRMED')
            .map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openReservationCard(a.id)}
                className="rounded-lg border border-[#D5DADF] bg-white px-2 py-0.5 text-[#34495E]"
              >
                {a.guest.fullName}
              </button>
            ))}
        </div>
      ) : null}

      <RoomRackView
        rooms={
          loading
            ? []
            : rooms.map((room) => ({
                ...room,
                rackDisplayState: computeRackDisplayState(room, filterDateFrom, filterDateTo),
              }))
        }
        selectedId={selected?.id ?? null}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        onFilterDateFromChange={setFilterDateFrom}
        onFilterDateToChange={setFilterDateTo}
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
            ? (reservationId, toRoomId, reasonCode) =>
                relocateToRoom(reservationId, toRoomId, reasonCode)
            : undefined
        }
        onHkStatus={
          can(PERMISSIONS.ROOMS_STATUS)
            ? (roomId, hk) => {
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await fetch(`/api/rooms/${roomId}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ hkCondition: hk }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showApiError(data, tCommon('updateFailed'));
                      return;
                    }
                    await load();
                  } catch (e) {
                    showApiError({ error: e instanceof Error ? e.message : tCommon('updateError') });
                  } finally {
                    setBusy(false);
                  }
                })();
              }
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
          setUnusedNightsRefundMethod('CASH');
          setEarlyCheckout(null);
          setCheckoutPrompt({
            id,
            guest: res?.guest.fullName ?? '',
            balance: Number(res?.totalAmount ?? 0),
          });
          void fetch(`/api/reservations/${id}/early-checkout-preview`)
            .then((r) => r.json())
            .then((data) => {
              const payload = data.data ?? data;
              if (payload?.applicable) {
                setEarlyCheckout({
                  applicable: true,
                  unusedNights: Number(payload.unusedNights) || 0,
                  unusedSellGross: Number(payload.unusedSellGross) || 0,
                  vatWithheld: Number(payload.vatWithheld) || 0,
                  guestCashRefund: Number(payload.guestCashRefund) || 0,
                });
              }
            })
            .catch(() => undefined);
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
                unusedNightsRefundMethod:
                  earlyCheckout?.applicable && earlyCheckout.guestCashRefund > 0
                    ? unusedNightsRefundMethod
                    : undefined,
              });
              setEarlyCheckout(null);
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
          {earlyCheckout?.applicable ? (
            <div className="space-y-1 rounded border border-[#BDC3C7] bg-[#F8F9F9] p-2">
              <p className="m-0 font-medium">{t('earlyCheckoutTitle')}</p>
              <p className="m-0">
                {t('earlyCheckoutNights', { count: earlyCheckout.unusedNights })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutGross', { amount: earlyCheckout.unusedSellGross.toFixed(2) })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutVat', { amount: earlyCheckout.vatWithheld.toFixed(2) })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutCash', { amount: earlyCheckout.guestCashRefund.toFixed(2) })}
              </p>
              {earlyCheckout.guestCashRefund > 0 ? (
                <label className="flex items-center gap-2">
                  <span>{t('earlyCheckoutTender')}</span>
                  <select
                    value={unusedNightsRefundMethod}
                    onChange={(e) =>
                      setUnusedNightsRefundMethod(e.target.value as 'CASH' | 'CARD')
                    }
                    className="rounded border border-[#BDC3C7] px-2 py-1"
                  >
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
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
