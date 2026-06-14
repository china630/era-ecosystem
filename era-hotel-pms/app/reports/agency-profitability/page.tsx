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
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function AgencyProfitContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [range, setRange] = useState(defaultRange);
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
    const q = `from=${range.from}&to=${range.to}`;
    const res = await fetch(`/api/reports/agency-profitability?${q}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? tc('loadError'));
    setData(json);
    setLoading(false);
  }, [range.from, range.to, tc]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-5xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-6xl">
      <PageHeader title={t('agencyProfitTitle')} subtitle={t('agencyProfitSubtitle')} />
      <PageSection>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[#7F8C8D]">
            {tc('from')}
            <input
              type="date"
              className="ml-2 rounded border border-[#D5DADF] px-2 py-1 text-[13px]"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="text-[12px] text-[#7F8C8D]">
            {tc('to')}
            <input
              type="date"
              className="ml-2 rounded border border-[#D5DADF] px-2 py-1 text-[13px]"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('load')}
          </button>
        </div>
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
      </PageSection>
    </AppShell>
  );
}

export default function AgencyProfitabilityPage() {
  return (
    <Suspense fallback={null}>
      <AgencyProfitContent />
    </Suspense>
  );
}
