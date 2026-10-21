'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DatePicker, EraListFilterBar, PageHeader } from '@era/satellite-kit/ui';
import { CashJournalPanel } from '@/components/front-cash/CashJournalPanel';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function FrontCashJournalPage() {
  const { can } = useAuth();
  const t = useTranslations('frontCashDesk');
  const tc = useTranslations('common');
  const params = useSearchParams();
  const [date, setDate] = useState(params.get('from') || params.get('date') || '');
  const [reservationId, setReservationId] = useState<string | null>(null);

  useEffect(() => {
    const from = params.get('from') || params.get('date');
    if (from) setDate(from);
  }, [params]);

  useEffect(() => {
    if (date) return;
    void fetch('/api/front-cash/journal')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.date === 'string') setDate(data.date);
      })
      .catch(() => undefined);
  }, [date]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.SCREEN_FRONT_CASH)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('journalTitle')} subtitle={t('journalSubtitle')} />
      <EraListFilterBar>
        <DatePicker
          label={tc('date')}
          value={date}
          onChange={setDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      {date ? <CashJournalPanel date={date} onOpenReservation={setReservationId} /> : null}
      <ReservationCardModal
        open={Boolean(reservationId)}
        reservationId={reservationId}
        initialTab="folio"
        onClose={() => setReservationId(null)}
      />
    </>
  );
}
