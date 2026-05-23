'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import RoomPlanGrid from '@/components/RoomPlanGrid';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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
      <AppShell maxWidthClass="max-w-[1400px]">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionRoomPlan')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {[14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={days === d ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              >
                {t('days', { count: d })}
              </button>
            ))}
          </>
        }
      />

      <StatusMessage>{msg}</StatusMessage>

      {selected && can(PERMISSIONS.RESERVATIONS_WRITE) && (
        <PageSection className="mb-4 flex flex-wrap items-center gap-3 text-[13px] text-[#34495E]">
          <span>
            <strong>{selected.guest.fullName}</strong> — {tRes(selected.status as 'CONFIRMED')} ·{' '}
            {selected.checkInDate.slice(0, 10)} → {selected.checkOutDate.slice(0, 10)}
          </span>
          <button type="button" disabled={busy} onClick={() => extendNights(1)} className={SECONDARY_BUTTON_CLASS}>
            {t('plusOneNight')}
          </button>
          <button type="button" disabled={busy} onClick={() => extendNights(2)} className={SECONDARY_BUTTON_CLASS}>
            {t('plusTwoNights')}
          </button>
          <Link href={`/folio/${selected.id}`} className="text-[#2980B9] hover:underline">
            {t('folio')}
          </Link>
        </PageSection>
      )}

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
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </AppShell>
  );
}
