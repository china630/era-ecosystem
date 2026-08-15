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
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function AnalyticsContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const defaults = defaultRange();
  const [range, setRange] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<{
    totalRevenue: number;
    rows: Array<{ code: string; name: string; revenue: number; reservations: number; sharePct: number }>;
  } | null>(null);
  const [cancellations, setCancellations] = useState<{
    totalCancelled: number;
    bySource: Array<{ code: string; count: number }>;
  } | null>(null);
  const [demographics, setDemographics] = useState<{
    adults: number;
    childBand0_6: number;
    childBand7_11: number;
    nationality: Array<{ code: string; count: number; sharePct: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = `from=${range.from}&to=${range.to}`;
    try {
      const [sRes, cRes, dRes] = await Promise.all([
        fetch(`/api/reports/booking-sources?${q}`),
        fetch(`/api/reports/cancellations?${q}`),
        fetch(`/api/reports/guest-demographics?${q}`),
      ]);
      const [sData, cData, dData] = await Promise.all([sRes.json(), cRes.json(), dRes.json()]);
      if (!sRes.ok) {
        showApiError(sData, tc('loadError'));
        return;
      }
      if (!cRes.ok) {
        showApiError(cData, tc('loadError'));
        return;
      }
      if (!dRes.ok) {
        showApiError(dData, tc('loadError'));
        return;
      }
      setSources(sData);
      setCancellations(cData);
      setDemographics(dData);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>;
  }

  return (
    <>
      <PageHeader title={t('analyticsTitle')} subtitle={t('analyticsSubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setRange(defaultRange())}
      >
        <DatePicker
          label={t('dateFrom')}
          value={range.from}
          onChange={(from) => setRange((r) => ({ ...r, from }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={t('dateTo')}
          value={range.to}
          onChange={(to) => setRange((r) => ({ ...r, to }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      {loading && <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>}

      {!loading && sources && (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('bookingSourcesTitle')}</h2>
          <p className="mb-3 text-[13px] text-[#7F8C8D]">
            {t('totalRevenue')}: {sources.totalRevenue.toFixed(2)} AZN
          </p>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('source')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('reservations')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('revenue')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>%</th>
                </tr>
              </thead>
              <tbody>
                {sources.rows.map((row) => (
                  <tr key={row.code} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.reservations}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.revenue.toFixed(2)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && cancellations && (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('cancellationsTitle')}</h2>
          <p className="mb-3 text-[13px] text-[#7F8C8D]">
            {t('totalCancelled')}: {cancellations.totalCancelled}
          </p>
          <ul className="space-y-1 text-[13px]">
            {cancellations.bySource.map((row) => (
              <li key={row.code}>
                {row.code}: {row.count}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && demographics && (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('demographicsTitle')}</h2>
          <p className="mb-3 text-[13px] text-[#7F8C8D]">
            {t('adults')}: {demographics.adults} · {t('childBand0_6')}: {demographics.childBand0_6} ·{' '}
            {t('childBand7_11')}: {demographics.childBand7_11}
          </p>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('nationality')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('count')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>%</th>
                </tr>
              </thead>
              <tbody>
                {demographics.nationality.map((row) => (
                  <tr key={row.code} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.count}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export default function AnalyticsReportPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<div className="p-8 text-[#7F8C8D]">{tc('loading')}</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
