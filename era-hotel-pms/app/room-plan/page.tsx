'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FilterMenuButton, PageHeader, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import ReservationCardModal from '@/components/ReservationCardModal';
import RoomPlanGrid, { type RoomPlanGroup, type RoomPlanRoom } from '@/components/RoomPlanGrid';
import { StatusMessage } from '@/components/layout/AppShell';
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
}

interface RoomPlanData {
  from: string;
  days: number;
  availabilityByDay: Record<string, number>;
  groups: {
    byType: Array<{
      key: string;
      label: string;
      roomCount: number;
      rooms: RoomPlanRoom[];
      availabilityByDay: Record<string, number>;
    }>;
    byFloor: Array<{
      key: string;
      label: string;
      roomCount: number;
      rooms: RoomPlanRoom[];
      availabilityByDay: Record<string, number>;
    }>;
  };
  rooms: RoomPlanRoom[];
  reservations: ReservationBar[];
  unassigned: ReservationBar[];
}

type GroupMode = 'flat' | 'type' | 'floor';

export default function RoomPlanPage() {
  const { can } = useAuth();
  const t = useTranslations('roomPlan');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');
  const [days, setDays] = useState(14);
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [data, setData] = useState<RoomPlanData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardReservationId, setCardReservationId] = useState<string | null>(null);
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

  async function moveReservation(reservationId: string, toRoomId: string) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: toRoomId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('updateFailed'));
        return;
      }
      showSuccess(t('moved'));
      setSelectedId(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('updateError'));
    } finally {
      setBusy(false);
    }
  }

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
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionRoomPlan')}</p>;
  }

  const groups: RoomPlanGroup[] | undefined =
    groupMode === 'type'
      ? (data?.groups.byType as RoomPlanGroup[])
      : groupMode === 'floor'
        ? (data?.groups.byFloor as RoomPlanGroup[])
        : undefined;

  return (
    <div className="min-w-0 w-full">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenuButton
              label={t('groupingLabel')}
              value={groupMode}
              options={[
                { value: 'type', label: t('groupByType') },
                { value: 'floor', label: t('groupByFloor') },
                { value: 'flat', label: t('groupFlat') },
              ]}
              onChange={(v) => setGroupMode(v as GroupMode)}
            />
            <FilterMenuButton
              label={t('periodLabel')}
              value={String(days)}
              options={[
                { value: '14', label: t('days', { count: 14 }) },
                { value: '21', label: t('days', { count: 21 }) },
                { value: '30', label: t('days', { count: 30 }) },
              ]}
              onChange={(v) => setDays(Number(v))}
            />
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => window.print()}>
              {t('print')}
            </button>
          </div>
        }
      />

      <StatusMessage>{msg}</StatusMessage>

      {selected && can(PERMISSIONS.RESERVATIONS_WRITE) && (
        <EraModal
          open={!!selectedId}
          title={selected.guest.fullName}
          subtitle={`${tRes(selected.status as 'CONFIRMED')} · ${selected.checkInDate.slice(0, 10)} → ${selected.checkOutDate.slice(0, 10)}`}
          onClose={() => setSelectedId(null)}
        >
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#34495E]">
            <button type="button" disabled={busy} onClick={() => extendNights(1)} className={SECONDARY_BUTTON_CLASS}>
              {t('plusOneNight')}
            </button>
            <button type="button" disabled={busy} onClick={() => extendNights(2)} className={SECONDARY_BUTTON_CLASS}>
              {t('plusTwoNights')}
            </button>
            <button
              type="button"
              className="text-[#2980B9] hover:underline"
              onClick={() => {
                setCardReservationId(selected.id);
                setSelectedId(null);
              }}
            >
              {t('openCard')}
            </button>
            <Link href={`/folio/${selected.id}`} className="text-[#2980B9] hover:underline">
              {t('folio')}
            </Link>
          </div>
        </EraModal>
      )}

      <ReservationCardModal
        open={Boolean(cardReservationId)}
        reservationId={cardReservationId}
        onClose={() => {
          setCardReservationId(null);
          void load();
        }}
      />

      {data?.unassigned && data.unassigned.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 text-[13px]">
          <span className="text-amber-800">{t('unassigned')}</span>
          {data.unassigned.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={`rounded-lg border px-2 py-0.5 ${
                selectedId === u.id
                  ? 'border-[#2980B9] bg-[#2980B9]/10 text-[#2980B9]'
                  : 'border-[#D5DADF] bg-white text-[#34495E]'
              }`}
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
          availabilityByDay={data.availabilityByDay}
          groups={groups}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            if (id) setCardReservationId(id);
          }}
          onMoveReservation={
            can(PERMISSIONS.RESERVATIONS_WRITE)
              ? (reservationId, toRoomId) => moveReservation(reservationId, toRoomId)
              : undefined
          }
          onResizeEnd={
            can(PERMISSIONS.RESERVATIONS_WRITE)
              ? async (reservationId, newCheckOutIso) => {
                  setBusy(true);
                  setMsg(null);
                  try {
                    const res = await fetch(`/api/reservations/${reservationId}/schedule`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ checkOutDate: newCheckOutIso }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error ?? tc('updateFailed'));
                    setMsg(t('extendTo', { date: newCheckOutIso.slice(0, 10) }));
                    await load();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : tc('updateError'));
                  } finally {
                    setBusy(false);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
