'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Booking = {
  id: string;
  label: string | null;
  startAt: string;
  endAt: string;
  saloon: { name: string } | null;
  banquetEvent: { eventName: string; pax: number; status: string };
};

export default function BanquetCalendarPage() {
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/banquets/calendar?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, tc]);

  useEffect(() => {
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('calendarTitle')}
        subtitle={t('calendarSubtitle')}
        actions={
          <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
            {tc('back')}
          </Link>
        }
      />
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <DatePicker
            label={tc('from')}
            value={from}
            onChange={setFrom}
            placeholder={tc('datePlaceholder')}
            preset="date"
          />
          <DatePicker
            label={tc('to')}
            value={to}
            onChange={setTo}
            placeholder={tc('datePlaceholder')}
            preset="date"
          />
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('refresh')}
          </button>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2">{t('eventName')}</th>
              <th className="py-2">{t('saloon')}</th>
              <th className="py-2">{t('eventDate')}</th>
              <th className="py-2">{t('pax')}</th>
              <th className="py-2">{tc('status')}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="py-2">{b.banquetEvent.eventName}</td>
                <td className="py-2">{b.saloon?.name ?? b.label ?? '—'}</td>
                <td className="py-2">{new Date(b.startAt).toLocaleString()}</td>
                <td className="py-2">{b.banquetEvent.pax}</td>
                <td className="py-2">{b.banquetEvent.status}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-[#7F8C8D]">
                  {t('calendarEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
