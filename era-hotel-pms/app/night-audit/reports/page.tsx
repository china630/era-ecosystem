'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type ReportDef = {
  code: string;
  labelKey:
    | 'reportInhouseDaily'
    | 'reportCancelledToday'
    | 'reportCreatedToday'
    | 'reportFolioTransactions'
    | 'reportRoomPriceControl'
    | 'reportNoShows'
    | 'reportRoomMoves'
    | 'reportVipInHouse'
    | 'reportCashTransactions'
    | 'reportAgencyLedger'
    | 'reportEodLogs'
    | 'reportReservationUpdates'
    | 'reportReservationTimes'
    | 'reportRoomChanges'
    | 'reportReservations';
  href: (date: string) => string;
  group: 'p0' | 'p1' | 'fo';
};

export default function NightAuditReportsHubPage() {
  const { can } = useAuth();
  const t = useTranslations('nightAudit');
  const tc = useTranslations('common');
  const [date, setDate] = useState(todayIso);

  const reports: ReportDef[] = useMemo(
    () => [
      {
        code: '01',
        labelKey: 'reportInhouseDaily',
        href: (d) => `/night-audit/inhouse-daily?date=${d}`,
        group: 'p0',
      },
      {
        code: '09',
        labelKey: 'reportCancelledToday',
        href: (d) => `/night-audit/reports/cancelled?date=${d}`,
        group: 'p1',
      },
      {
        code: '10',
        labelKey: 'reportCreatedToday',
        href: (d) => `/night-audit/reports/created?date=${d}`,
        group: 'p1',
      },
      {
        code: '11',
        labelKey: 'reportFolioTransactions',
        href: (d) => `/night-audit/reports/folio-transactions?date=${d}`,
        group: 'p1',
      },
      {
        code: '12',
        labelKey: 'reportRoomPriceControl',
        href: (d) => `/night-audit/reports/room-price-control?date=${d}`,
        group: 'p1',
      },
      {
        code: '13',
        labelKey: 'reportNoShows',
        href: (d) => `/night-audit/reports/no-shows?date=${d}`,
        group: 'p1',
      },
      {
        code: '14',
        labelKey: 'reportRoomMoves',
        href: (d) => `/night-audit/reports/room-moves?date=${d}`,
        group: 'p1',
      },
      {
        code: '15',
        labelKey: 'reportVipInHouse',
        href: (d) => `/night-audit/reports/vip-in-house?date=${d}`,
        group: 'p1',
      },
      {
        code: '05',
        labelKey: 'reportCashTransactions',
        href: (d) => `/front-cash/transactions?from=${d}&to=${d}`,
        group: 'p0',
      },
      {
        code: '06',
        labelKey: 'reportAgencyLedger',
        href: (d) => `/front-cash/agency-ledger?from=${d}&to=${d}`,
        group: 'p0',
      },
      {
        code: '07',
        labelKey: 'reportEodLogs',
        href: () => `/night-audit/logs`,
        group: 'p0',
      },
      {
        code: '08',
        labelKey: 'reportReservationUpdates',
        href: (d) => `/night-audit/reservation-updates?from=${d}&to=${d}`,
        group: 'p0',
      },
      {
        code: '02',
        labelKey: 'reportReservationTimes',
        href: () => `/fo/reservation-times`,
        group: 'fo',
      },
      {
        code: '03',
        labelKey: 'reportRoomChanges',
        href: () => `/fo/room-changes`,
        group: 'fo',
      },
      {
        code: '04',
        labelKey: 'reportReservations',
        href: () => `/fo/reservations`,
        group: 'fo',
      },
    ],
    [],
  );

  if (!can(PERMISSIONS.REPORTS_READ) && !can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  const renderGroup = (group: ReportDef['group'], title: string) => (
    <div className="mb-4 last:mb-0">
      <h2 className="mb-2 text-[13px] font-semibold text-[#2C3E50]">{title}</h2>
      <ol className="m-0 list-none space-y-2 p-0 text-[13px] text-[#34495E]">
        {reports
          .filter((r) => r.group === group)
          .map((r) => (
            <li key={r.code}>
              <Link
                href={r.href(date)}
                className="text-[#2980B9] hover:underline"
              >
                {r.code} — {t(r.labelKey)}
              </Link>
            </li>
          ))}
      </ol>
    </div>
  );

  return (
    <>
      <PageHeader title={t('reportsTitle')} subtitle={t('reportsSubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setDate(todayIso())}
      >
        <DatePicker
          label={tc('date')}
          value={date}
          onChange={setDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        {renderGroup('p1', t('reportsGroupP1'))}
        {renderGroup('p0', t('reportsGroupOps'))}
        {renderGroup('fo', t('reportsGroupFo'))}
        <p className="mt-3 mb-0 text-[12px] text-[#7F8C8D]">{t('reportsHubHint')}</p>
      </section>
    </>
  );
}
