'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@era/satellite-kit/ui';
import { SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const res = await fetch(`/api/banquets/calendar?${qs}`);
    const data = await res.json();
    setBookings(Array.isArray(data) ? data : []);
  }, [from, to]);

  useEffect(() => {
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={t('calendarTitle')}
        subtitle={t('calendarSubtitle')}
        actions={
          <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
            {tc('back')}
          </Link>
        }
      />
      <PageSection>
        <div className="mb-4 flex gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
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
      </PageSection>
    </AppShell>
  );
}
