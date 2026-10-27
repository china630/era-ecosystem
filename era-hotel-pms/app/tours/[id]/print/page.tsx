'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { bakuTimeLabel } from '@era/satellite-kit/time';
import { showApiError } from '@era/satellite-kit/ui';

type Row = {
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  vehicle: {
    code: string;
    licensePlate: string;
    driverName: string | null;
    driverPhone: string | null;
    maxSeats: number;
  } | null;
  bookings: Array<{
    status: string;
    reservation: {
      guest: { fullName: string; phone: string | null };
      room: { roomNumber: string } | null;
    };
  }>;
};

export default function TourPrintPage() {
  const t = useTranslations('tours');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const [dep, setDep] = useState<Row | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch(`/api/tours/departures/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          showApiError(await r.json().catch(() => ({ error: r.statusText })));
          setError(true);
          return;
        }
        setDep(await r.json());
      })
      .catch(() => setError(true));
  }, [id]);

  if (error) return <p className="p-4">{tc('loadError')}</p>;
  if (!dep) return null;
  const live = dep.bookings.filter((b) => b.status !== 'CANCELLED');
  const paid = live.filter((b) => b.status === 'PAID').length;
  const charged = live.filter((b) => b.status === 'CHARGED' || b.status === 'ON_CITY_LEDGER').length;

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      RESERVED: t('reserved'),
      CHARGED: t('charged'),
      PAID: t('paid'),
      ON_CITY_LEDGER: t('onCityLedger'),
    };
    return map[s] ?? s;
  }

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-black print:p-0">
      <h1 className="text-xl font-bold">{dep.agenda}</h1>
      <p>
        {dep.date.slice(0, 10)} · {t('pickup')} {bakuTimeLabel(dep.pickupAt)} · {t('return')}{' '}
        {bakuTimeLabel(dep.returnAt)}
      </p>
      <p>
        {t('meetingPoint')}: {dep.meetingPoint} · {t('guide')}: {dep.guideName ?? '—'}
      </p>
      <p>
        {t('vehicle')}: {dep.vehicle ? `${dep.vehicle.code} ${dep.vehicle.licensePlate}` : '—'} ·{' '}
        {dep.vehicle?.driverName} {dep.vehicle?.driverPhone}
      </p>
      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border p-1">{t('room')}</th>
            <th className="border p-1">{tc('guest')}</th>
            <th className="border p-1">{t('phone')}</th>
            <th className="border p-1">{t('moneyStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {live.map((b, i) => (
            <tr key={i}>
              <td className="border p-1">{b.reservation.room?.roomNumber ?? '—'}</td>
              <td className="border p-1">{b.reservation.guest.fullName}</td>
              <td className="border p-1">{b.reservation.guest.phone}</td>
              <td className="border p-1">{statusLabel(b.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3">
        {t('seats')}: {live.length}/{dep.capacity} · {t('paid')}: {paid} · {t('charged')}: {charged}
      </p>
      <button type="button" className="mt-4 print:hidden" onClick={() => window.print()}>
        {t('print')}
      </button>
    </div>
  );
}
