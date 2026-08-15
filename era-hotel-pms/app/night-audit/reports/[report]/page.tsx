'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

const REPORTS = [
  'cancelled',
  'created',
  'folio-transactions',
  'room-price-control',
  'no-shows',
  'room-moves',
  'vip-in-house',
] as const;

type ReportKey = (typeof REPORTS)[number];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isReport(v: string): v is ReportKey {
  return (REPORTS as readonly string[]).includes(v);
}

export default function NightAuditEodReportPage() {
  const { can } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('nightAudit');
  const tc = useTranslations('common');
  const reportParam = String(params.report ?? '');
  const report = isReport(reportParam) ? reportParam : null;
  const [date, setDate] = useState(todayIso);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const d = searchParams.get('date');
    if (d) setDate(d);
  }, [searchParams]);

  const title = useMemo(() => {
    if (!report) return t('reportsTitle');
    const map: Record<ReportKey, string> = {
      cancelled: t('reportCancelledToday'),
      created: t('reportCreatedToday'),
      'folio-transactions': t('reportFolioTransactions'),
      'room-price-control': t('reportRoomPriceControl'),
      'no-shows': t('reportNoShows'),
      'room-moves': t('reportRoomMoves'),
      'vip-in-house': t('reportVipInHouse'),
    };
    return map[report];
  }, [report, t]);

  const load = useCallback(async () => {
    if (!report) return;
    try {
      const res = await fetch(
        `/api/night-audit/eod-reports?type=${report}&date=${date}`,
      );
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('loadError'));
        return;
      }
      setData(json);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [report, date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ) && !can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  if (!report) {
    return (
      <p className="text-[13px] text-[#7F8C8D]">
        {t('unknownReport')}{' '}
        <Link href="/night-audit/reports" className="text-[#2980B9] hover:underline">
          {t('reportsTitle')}
        </Link>
      </p>
    );
  }

  const items = Array.isArray(data?.items) ? (data.items as Record<string, unknown>[]) : [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={t('eodReportSubtitle')}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              const rows = items.map((r) => Object.values(r).join(','));
              const header = items[0] ? Object.keys(items[0]).join(',') : 'empty';
              const blob = new Blob([[header, ...rows].join('\n')], {
                type: 'text/csv;charset=utf-8',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `eod-${report}-${date}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('exportCsv')}
          </button>
        }
      />
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
      <p className="mb-2 text-[12px] text-[#7F8C8D]">
        <Link href="/night-audit/reports" className="text-[#2980B9] hover:underline">
          {t('backToReportsHub')}
        </Link>
      </p>
      <section className={`${CARD_CONTAINER_CLASS} p-0`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                {report === 'cancelled' || report === 'created' ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStatus')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colSource')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                  </>
                ) : null}
                {report === 'folio-transactions' ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colTime')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colEntry')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                  </>
                ) : null}
                {report === 'room-price-control' ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRateFlags')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                  </>
                ) : null}
                {report === 'no-shows' || report === 'vip-in-house' ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStatus')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                  </>
                ) : null}
                {report === 'room-moves' ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colFromRoom')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colToRoom')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStatus')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const id = String(r.id ?? '');
                if (report === 'cancelled' || report === 'created') {
                  return (
                    <tr key={id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.guestName ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.roomNumber ?? r.roomTypeCode ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.status ?? (report === 'cancelled' ? 'CANCELLED' : tc('dash')))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.sourceCode ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Link
                          href={`/reservations/${id}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {t('openReservation')}
                        </Link>
                      </td>
                    </tr>
                  );
                }
                if (report === 'folio-transactions') {
                  return (
                    <tr key={`${r.entryType}-${id}`} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {r.at ? new Date(String(r.at)).toLocaleString() : tc('dash')}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.entryType)}
                        {r.code ? ` · ${String(r.code)}` : ''}
                        {r.method ? ` · ${String(r.method)}` : ''}
                        {r.kind ? ` · ${String(r.kind)}` : ''}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.guestName ?? tc('dash'))}
                        {r.roomNumber ? ` · ${String(r.roomNumber)}` : ''}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {Number(r.amount).toFixed(2)} {tc('azn')}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Link
                          href={`/folio/${String(r.reservationId)}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {t('openFolio')}
                        </Link>
                      </td>
                    </tr>
                  );
                }
                if (report === 'no-shows' || report === 'vip-in-house') {
                  return (
                    <tr key={id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.guestName ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.roomNumber ?? r.roomTypeCode ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.vipType ?? r.status ?? (report === 'no-shows' ? 'NO_SHOW' : tc('dash')))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Link
                          href={`/reservations/${String(r.reservationId ?? id)}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {t('openReservation')}
                        </Link>
                      </td>
                    </tr>
                  );
                }
                if (report === 'room-moves') {
                  return (
                    <tr key={id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(r.guestName ?? tc('dash'))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{String(r.fromRoom ?? tc('dash'))}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{String(r.toRoom ?? tc('dash'))}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{String(r.status ?? tc('dash'))}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Link
                          href={`/reservations/${String(r.reservationId ?? id)}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {t('openReservation')}
                        </Link>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {String(r.guestName ?? tc('dash'))}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {String(r.roomNumber ?? r.roomTypeCode ?? tc('dash'))}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {[
                        r.useManualRate ? 'MANUAL' : null,
                        r.dailyManualFlag ? 'DAY_MANUAL' : null,
                        r.fixPrice ? 'FIX' : null,
                        r.discountPct ? `DISC ${String(r.discountPct)}%` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || tc('dash')}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.stayAmount != null
                        ? `${Number(r.stayAmount).toFixed(2)} ${tc('azn')}`
                        : r.manualDailyRate != null
                          ? `${Number(r.manualDailyRate).toFixed(2)} ${tc('azn')}`
                          : tc('dash')}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <Link
                        href={`/reservations/${id}`}
                        className="text-[#2980B9] hover:underline"
                      >
                        {t('openReservation')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('eodReportEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
