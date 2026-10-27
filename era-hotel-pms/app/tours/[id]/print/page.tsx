'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';
import { bakuTimeLabel } from '@era/satellite-kit/time';
import { PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

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

type Profile = {
  name?: string | null;
  printName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoPath?: string | null;
};

export default function TourPrintPage() {
  const t = useTranslations('tours');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [dep, setDep] = useState<Row | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
    void fetch('/api/hotel/profile')
      .then(async (r) => {
        if (r.ok) setProfile(await r.json());
      })
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!dep || error) return;
    if (searchParams.get('autoprint') === '1') {
      const timer = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(timer);
    }
  }, [dep, error, searchParams]);

  if (error) return <p className="p-4">{tc('loadError')}</p>;
  if (!dep) return null;

  const live = dep.bookings.filter((b) => b.status !== 'CANCELLED');
  const paid = live.filter((b) => b.status === 'PAID').length;
  const charged = live.filter((b) => b.status === 'CHARGED' || b.status === 'ON_CITY_LEDGER').length;
  const reserved = live.filter((b) => b.status === 'RESERVED').length;
  const boarded = live.filter((b) => ['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status)).length;
  const letterName = profile?.printName?.trim() || profile?.name?.trim() || '';
  const contacts = [profile?.address, profile?.phone, profile?.email, profile?.website]
    .map((x) => x?.trim())
    .filter(Boolean) as string[];
  const hasLogo = Boolean(profile?.logoPath);

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      RESERVED: t('reserved'),
      CHARGED: t('charged'),
      PAID: t('paid'),
      ON_CITY_LEDGER: t('onCityLedger'),
    };
    return map[s] ?? s;
  }

  function dashOr(value: string | null | undefined, emptyLabel: string) {
    const v = value?.trim();
    return v ? v : emptyLabel;
  }

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0">
      <div className="mx-auto max-w-[800px]">
        {(letterName || hasLogo || contacts.length > 0) && (
          <header className="mb-4 flex items-start gap-4 border-b border-[#D5DADF] pb-3">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/api/hotel/profile/logo"
                alt=""
                className="h-14 w-auto max-w-[120px] object-contain"
              />
            ) : null}
            <div>
              {letterName ? <p className="m-0 text-base font-semibold">{letterName}</p> : null}
              {contacts.map((line) => (
                <p key={line} className="m-0 text-[12px] text-[#34495E]">
                  {line}
                </p>
              ))}
            </div>
          </header>
        )}

        <h1 className="text-xl font-bold">{dep.agenda}</h1>
        <p>
          {dep.date.slice(0, 10)} · {t('pickup')} {bakuTimeLabel(dep.pickupAt)} · {t('return')}{' '}
          {bakuTimeLabel(dep.returnAt)}
        </p>
        <p>
          {t('meetingPoint')}: {dashOr(dep.meetingPoint, t('notSet'))} · {t('guide')}:{' '}
          {dashOr(dep.guideName, t('notSet'))}
        </p>
        <p>
          {t('vehicle')}:{' '}
          {dep.vehicle
            ? `${dep.vehicle.code} ${dep.vehicle.licensePlate}`
            : t('vehicleMissing')}
          {dep.vehicle?.driverName
            ? ` · ${dep.vehicle.driverName}${dep.vehicle.driverPhone ? ` ${dep.vehicle.driverPhone}` : ''}`
            : ''}
        </p>
        {!dep.vehicle ? (
          <p className="text-[12px] text-[#9A7D0A] print:text-black">{t('vehicleMissingHint')}</p>
        ) : null}

        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border p-1 text-left">{t('room')}</th>
              <th className="border p-1 text-left">{tc('guest')}</th>
              <th className="border p-1 text-left">{t('phone')}</th>
              <th className="border p-1 text-left">{t('boarded')}</th>
              <th className="border p-1 text-left">{t('moneyStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {live.map((b, i) => (
              <tr key={i}>
                <td className="border p-1">{b.reservation.room?.roomNumber ?? '—'}</td>
                <td className="border p-1">{b.reservation.guest.fullName}</td>
                <td className="border p-1">{b.reservation.guest.phone ?? '—'}</td>
                <td className="border p-1">
                  {['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status)
                    ? t('boardedYes')
                    : t('boardedNo')}
                </td>
                <td className="border p-1">{statusLabel(b.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3">
          {t('seats')}: {live.length}/{dep.capacity} · {t('boarded')}: {boarded} · {t('reserved')}:{' '}
          {reserved} · {t('paid')}: {paid} · {t('charged')}: {charged}
        </p>
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} mt-4 print:hidden`}
          onClick={() => window.print()}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {t('print')}
        </button>
      </div>
    </div>
  );
}
