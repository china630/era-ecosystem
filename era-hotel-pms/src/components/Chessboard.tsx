'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  LIST_PAGE_SHELL_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { FolioCheckoutModal } from '@/components/folio/FolioCheckoutModal';
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
  const [revenueCodes, setRevenueCodes] = useState<
    { id: string; code: string; systemRole: string | null; active?: boolean }[]
  >([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
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
      const revRows = Array.isArray(revData) ? revData : [];
      setRevenueCodes(revRes.ok ? revRows.filter((row) => row.active !== false) : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tCommon('loadError') });
    } finally {
      setLoading(false);
    }
  }, [t, tCommon, filterDateFrom, filterDateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const foodCode = revenueCodes.find((r) => r.systemRole === 'FOOD');

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
    opts?: { reasonCode?: 'GUEST_REFUSED' | 'DID_NOT_OCCUPY' | 'HOTEL'; settlement?: 'HOTEL' | 'GUEST_PAY' | 'HOTEL_REFUND' | 'GUEST_CHEAPER' },
  ) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: toRoomId,
          ...(opts?.reasonCode ? { reasonCode: opts.reasonCode } : {}),
          ...(opts?.settlement ? { settlement: opts.settlement } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tCommon('actionFailed'));
        return;
      }
      showSuccess(data?.pending ? t('movePlanned') : t('relocated'));
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
        showApiError(
          data?.code === 'OCCUPIED_HK_LOCKED' ? { error: t('occupiedHkLocked') } : data,
          tCommon('updateFailed'),
        );
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
            ? (reservationId, toRoomId, opts) => relocateToRoom(reservationId, toRoomId, opts)
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
                      showApiError(
                        data?.code === 'OCCUPIED_HK_LOCKED'
                          ? { error: t('occupiedHkLocked') }
                          : data,
                        tCommon('updateFailed'),
                      );
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
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        onClose={() => setSelected(null)}
        busy={busy}
        canFolioRead={can(PERMISSIONS.FOLIO_READ)}
        canCheckIn={can(PERMISSIONS.RESERVATIONS_CHECKIN)}
        canCheckOut={can(PERMISSIONS.RESERVATIONS_CHECKOUT)}
        canCharge={can(PERMISSIONS.FOLIO_CHARGE)}
        foodCodeId={foodCode?.id}
        onCheckIn={(id) => runAction(`/api/reservations/${id}/check-in`)}
        onCheckOut={(id) => setCheckoutId(id)}
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

      <FolioCheckoutModal
        open={Boolean(checkoutId)}
        reservationId={checkoutId ?? ''}
        onClose={() => setCheckoutId(null)}
        onDone={() => {
          setSelected(null);
          void load();
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
