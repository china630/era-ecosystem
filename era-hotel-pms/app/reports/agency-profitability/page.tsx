'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function AgencyProfitContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const defaults = defaultRange();
  const [range, setRange] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalRevenue: number;
    rows: Array<{
      agencyName: string;
      sourceName: string | null;
      revenue: number;
      roomNights: number;
      adr: number;
      reservations: number;
      cancellationRatePct: number;
      cityLedgerNet: number;
    }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = `from=${range.from}&to=${range.to}`;
      const res = await fetch(`/api/reports/agency-profitability?${q}`);
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('loadError'));
        return;
      }
      setData(json);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('agencyProfitTitle')} subtitle={t('agencyProfitSubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setRange(defaultRange())}
      >
        <DatePicker
          label={tc('from')}
          value={range.from}
          onChange={(from) => setRange((r) => ({ ...r, from }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={range.to}
          onChange={(to) => setRange((r) => ({ ...r, to }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        {loading ? <p>{tc('loading')}</p> : null}
        {data ? (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agencyCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sourceCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('revenueCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('nightsCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>ADR</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('reservationsCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cancelRateCol')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cityLedgerNetCol')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.agencyName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sourceName ?? '—'}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.revenue.toFixed(2)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.roomNights}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.adr.toFixed(2)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.reservations}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.cancellationRatePct}%</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.cityLedgerNet.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

export default function AgencyProfitabilityPage() {
  return (
    <Suspense fallback={null}>
      <AgencyProfitContent />
    </Suspense>
  );
}
