'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  FieldSelect,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Booking = {
  id: string;
  status: string;
  reservation: { guest: { fullName: string; phone: string | null }; room: { number: string } | null };
};

type Departure = {
  id: string;
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  price: number;
  status: string;
  vehicleId: string | null;
  vehicle: { code: string; licensePlate: string; maxSeats: number } | null;
  bookings: Booking[];
};

export default function TourDeparturePage() {
  const t = useTranslations('tours');
  const { id } = useParams<{ id: string }>();
  const [dep, setDep] = useState<Departure | null>(null);
  const [inHouse, setInHouse] = useState<Array<{ id: string; guest: { fullName: string }; room: { number: string } | null }>>(
    [],
  );
  const [reservationId, setReservationId] = useState('');
  const [vehicles, setVehicles] = useState<Array<{ id: string; code: string; licensePlate: string }>>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tours/departures/${id}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    setDep(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
    void fetch('/api/tours/in-house')
      .then((r) => r.json())
      .then(setInHouse)
      .catch(() => undefined);
    void fetch('/api/fleet/vehicles')
      .then((r) => r.json())
      .then(setVehicles)
      .catch(() => undefined);
  }, [load]);

  async function addGuest() {
    if (!reservationId) return;
    const res = await fetch(`/api/tours/departures/${id}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess('ok');
    setReservationId('');
    await load();
  }

  async function pay(bookingId: string) {
    const res = await fetch(`/api/tours/bookings/${bookingId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'CASH' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    await load();
  }

  async function remove(bookingId: string) {
    const res = await fetch(`/api/tours/bookings/${bookingId}`, { method: 'DELETE' });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    await load();
  }

  async function saveVehicle(vehicleId: string) {
    const res = await fetch(`/api/tours/departures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: vehicleId || null, status: vehicleId ? 'OPEN' : 'DRAFT' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    await load();
  }

  async function markDeparted() {
    const res = await fetch(`/api/tours/departures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DEPARTED' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    await load();
  }

  if (!dep) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={dep.agenda || t('title')} subtitle={`${dep.date.slice(0, 10)} · ${dep.status}`} />
      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-[13px]`}>
        <p>
          {t('pickup')}: {new Date(dep.pickupAt).toLocaleString()} → {t('return')}:{' '}
          {new Date(dep.returnAt).toLocaleString()}
        </p>
        <p>
          {t('meetingPoint')}: {dep.meetingPoint || '—'} · {t('guide')}: {dep.guideName || '—'}
        </p>
        <p>
          {t('price')}: {Number(dep.price)} · {t('seats')}: {dep.bookings.filter((b) => b.status !== 'CANCELLED').length}/
          {dep.capacity}
        </p>
        <FieldSelect
          label={t('vehicle')}
          preset="select"
          value={dep.vehicleId ?? ''}
          onChange={(e) => void saveVehicle(e.target.value)}
        >
          <option value="">—</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} {v.licensePlate}
            </option>
          ))}
        </FieldSelect>
        <div className="flex gap-2">
          <Link href={`/tours/${id}/print`} className={SECONDARY_BUTTON_CLASS} target="_blank">
            {t('print')}
          </Link>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void markDeparted()}>
            {t('markDeparted')}
          </button>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-2 font-semibold">{t('addGuest')}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('addGuest')}
            value={reservationId}
            onChange={(v) => setReservationId(String(v))}
            options={inHouse.map((r) => ({
              value: r.id,
              label: `${r.room?.number ?? '—'} · ${r.guest.fullName}`,
            }))}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addGuest()}>
            {t('addGuest')}
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-[13px]">
          {dep.bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2">
              <span>
                {b.reservation.room?.number} · {b.reservation.guest.fullName} · {b.status}
              </span>
              {b.status === 'CHARGED' ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void pay(b.id)}>
                  {t('pay')}
                </button>
              ) : null}
              {b.status !== 'PAID' && b.status !== 'CANCELLED' ? (
                <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void remove(b.id)}>
                  {t('remove')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
