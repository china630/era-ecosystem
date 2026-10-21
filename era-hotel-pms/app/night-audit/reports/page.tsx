'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
} from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug, reportHref } from '@/lib/reports/catalog';

function wallClock() {
  return hotelDateKey();
}

type ReportDef = {
  code: string;
  labelKey:
    | 'reportInhouseDaily'
    | 'reportPoliceList'
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
  const locale = useLocale();
  const tc = useTranslations('common');
  const [businessDate, setBusinessDate] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    void fetch('/api/night-audit/status')
      .then((res) => res.json())
      .then((data) => {
        const key = data?.businessDate?.currentBusinessDate;
        const next = typeof key === 'string' && key ? key : wallClock();
        setBusinessDate(next);
        setDate(next);
      })
      .catch(() => {
        const next = wallClock();
        setBusinessDate(next);
        setDate(next);
      });
  }, []);

  const reports: ReportDef[] = useMemo(
    () => [
      {
        code: '01',
        labelKey: 'reportInhouseDaily',
        href: (d) => `/night-audit/inhouse-daily?date=${d}`,
        group: 'p0',
      },
      {
        code: '19',
        labelKey: 'reportPoliceList',
        href: (d) => {
          const def = getReportBySlug('police-list');
          return def ? reportHref(def, { from: d, to: d }) : '/reports?report=police-list';
        },
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
                href={date ? r.href(date) : '#'}
                className="text-[#2980B9] hover:underline"
              >
                {r.code} — {t(r.labelKey)}
              </Link>
            </li>
          ))}
      </ol>
    </div>
  );

  const packSlugs = [
    { slug: 'daily-management', label: 'B-01 Daily Management' },
    { slug: 'trial-balance-period', label: 'B-02 Trial Balance' },
    { slug: 'cash-report', label: 'B-03 Cash Report' },
    { slug: 'monthly-daily-analysis', label: 'A-11 Monthly Daily' },
    { slug: 'in-house', label: 'B-08 In-House' },
    { slug: 'annual-occupancy', label: 'A-07 Annual Occupancy' },
    { slug: 'folio-transactions', label: 'B-04 Folio Txns' },
    { slug: 'department-revenues', label: 'B-05 Dept Revenues' },
    { slug: 'police-list', label: t('reportPoliceList') },
  ];

  return (
    <>
      <PageHeader title={t('reportsTitle')} subtitle={t('reportsSubtitle')} />
      {!date ? <p className="mb-4 text-[13px] text-[#7F8C8D]">{tc('loading')}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <h2 className="mb-2 text-[13px] font-semibold text-[#2C3E50]">
          Report Pack (PDF)
        </h2>
        <div className="flex flex-wrap gap-2">
          {packSlugs.map((p) => {
            const def = getReportBySlug(p.slug);
            const href = def
              ? reportHref(def, { from: date, to: date })
              : `/reports?report=${encodeURIComponent(p.slug)}`;
            return (
            <Link
              key={p.slug}
              href={date ? href : '#'}
              aria-disabled={!date}
              className="rounded bg-[#ECF0F1] px-2 py-1 text-[12px] text-[#2980B9] hover:bg-[#D5DBDB]"
            >
              {p.label}
            </Link>
            );
          })}
          <Link
            href={date ? `/api/reports/pack/download?businessDate=${date}&lang=${locale}` : '#'}
            className="rounded bg-[#2980B9] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#2471A3]"
          >
            ⬇ Download ZIP
          </Link>
        </div>
      </section>
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setDate(businessDate || wallClock())}
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
