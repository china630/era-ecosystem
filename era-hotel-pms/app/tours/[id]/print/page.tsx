'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Row = {
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  vehicle: { code: string; licensePlate: string; driverName: string | null; driverPhone: string | null; maxSeats: number } | null;
  bookings: Array<{
    status: string;
    reservation: { guest: { fullName: string; phone: string | null }; room: { number: string } | null };
  }>;
};

export default function TourPrintPage() {
  const t = useTranslations('tours');
  const { id } = useParams<{ id: string }>();
  const [dep, setDep] = useState<Row | null>(null);

  useEffect(() => {
    void fetch(`/api/tours/departures/${id}`)
      .then((r) => r.json())
      .then(setDep);
  }, [id]);

  if (!dep) return null;
  const live = dep.bookings.filter((b) => b.status !== 'CANCELLED');
  const paid = live.filter((b) => b.status === 'PAID').length;

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-black print:p-0">
      <h1 className="text-xl font-bold">{dep.agenda}</h1>
      <p>
        {dep.date.slice(0, 10)} · {t('pickup')} {new Date(dep.pickupAt).toLocaleTimeString()} · {t('return')}{' '}
        {new Date(dep.returnAt).toLocaleTimeString()}
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
            <th className="border p-1">Room</th>
            <th className="border p-1">Guest</th>
            <th className="border p-1">Phone</th>
            <th className="border p-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {live.map((b, i) => (
            <tr key={i}>
              <td className="border p-1">{b.reservation.room?.number}</td>
              <td className="border p-1">{b.reservation.guest.fullName}</td>
              <td className="border p-1">{b.reservation.guest.phone}</td>
              <td className="border p-1">{b.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3">
        {t('seats')}: {live.length}/{dep.capacity} · {t('paid')}: {paid} · {t('charged')}: {live.length - paid}
      </p>
      <button type="button" className="mt-4 print:hidden" onClick={() => window.print()}>
        {t('print')}
      </button>
    </div>
  );
}
