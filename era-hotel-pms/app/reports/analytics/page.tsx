'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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
  const [range, setRange] = useState(defaultRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    const q = `from=${range.from}&to=${range.to}`;
    try {
      const [sRes, cRes, dRes] = await Promise.all([
        fetch(`/api/reports/booking-sources?${q}`),
        fetch(`/api/reports/cancellations?${q}`),
        fetch(`/api/reports/guest-demographics?${q}`),
      ]);
      const [sData, cData, dData] = await Promise.all([sRes.json(), cRes.json(), dRes.json()]);
      if (!sRes.ok) throw new Error(sData.error ?? tc('loadError'));
      if (!cRes.ok) throw new Error(cData.error ?? tc('loadError'));
      if (!dRes.ok) throw new Error(dData.error ?? tc('loadError'));
      setSources(sData);
      setCancellations(cData);
      setDemographics(dData);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('error'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-6xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-6xl">
      <PageHeader
        title={t('analyticsTitle')}
        subtitle={t('analyticsSubtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('load')}
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="text-[13px] text-[#34495E]">
          {t('dateFrom')}
          <input
            type="date"
            className="ml-2 rounded border px-2 py-1"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-[13px] text-[#34495E]">
          {t('dateTo')}
          <input
            type="date"
            className="ml-2 rounded border px-2 py-1"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
      </div>

      {error && <p className="mb-4 text-[13px] text-rose-600">{error}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>}

      {!loading && sources && (
        <PageSection title={t('bookingSourcesTitle')} className="mb-6">
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
        </PageSection>
      )}

      {!loading && cancellations && (
        <PageSection title={t('cancellationsTitle')} className="mb-6">
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
        </PageSection>
      )}

      {!loading && demographics && (
        <PageSection title={t('demographicsTitle')}>
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
        </PageSection>
      )}
    </AppShell>
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
