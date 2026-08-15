const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function writeUtf8(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, data.endsWith('\n') ? data : data + '\n', 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16: ' + p);
  console.log('ok', rel);
}

writeUtf8(
  'app/reports/analytics/page.tsx',
  `'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
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
import { PageSection } from '@/components/layout/AppShell';
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
  const [draft, setDraft] = useState(defaults);
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
    const q = \`from=\${range.from}&to=\${range.to}\`;
    try {
      const [sRes, cRes, dRes] = await Promise.all([
        fetch(\`/api/reports/booking-sources?\${q}\`),
        fetch(\`/api/reports/cancellations?\${q}\`),
        fetch(\`/api/reports/guest-demographics?\${q}\`),
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
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setRange(draft)}
        onReset={() => {
          const d = defaultRange();
          setDraft(d);
          setRange(d);
        }}
      >
        <DatePicker
          label={t('dateFrom')}
          value={draft.from}
          onChange={(from) => setDraft((r) => ({ ...r, from }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={t('dateTo')}
          value={draft.to}
          onChange={(to) => setDraft((r) => ({ ...r, to }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

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
`,
);

writeUtf8(
  'app/reports/occupancy/page.tsx',
  `'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface OccupancyCell {
  date: string;
  total: number;
  sold: number;
  available: number;
}

interface OccupancyRow {
  roomTypeId: string;
  code: string;
  name: string;
  cells: OccupancyCell[];
  avgOccupancyPct: number;
}

interface OccupancyGrid {
  from: string;
  days: number;
  dates: string[];
  rows: OccupancyRow[];
}

function cellClass(available: number): string {
  if (available < 0) return 'bg-rose-50 text-rose-800';
  if (available <= 2) return 'bg-amber-50 text-amber-900';
  return 'bg-[#F1F5F9] text-[#34495E]';
}

function OccupancyContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = parseInt(searchParams.get('days') ?? '30', 10);
  const [daysDraft, setDaysDraft] = useState(String(days));

  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(\`/api/reports/occupancy?days=\${days}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setGrid(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setLoading(false);
    }
  }, [days, tc]);

  useEffect(() => {
    setDaysDraft(String(days));
    void load();
  }, [load, days]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>;
  }

  return (
    <>
      <PageHeader title={t('occupancyTitle')} subtitle={t('occupancySubtitle')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          const n = parseInt(daysDraft, 10) || 30;
          router.push(\`/reports/occupancy?days=\${n}\`);
        }}
        onReset={() => {
          setDaysDraft('30');
          router.push('/reports/occupancy?days=30');
        }}
      >
        <FieldSelect
          label={t('days30').includes('30') ? tc('date') : tc('date')}
          preset="shortText"
          value={daysDraft}
          onChange={(e) => setDaysDraft(e.target.value)}
        >
          <option value="14">{t('days14')}</option>
          <option value="30">{t('days30')}</option>
        </FieldSelect>
      </EraListFilterBar>

      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('legend')}</p>
      {loading && <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>}

      {grid && !loading && (
        <PageSection className="p-0">
          <div className={\`\${DATA_TABLE_VIEWPORT_CLASS} rounded-none border-0 shadow-none\`}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={\`\${DATA_TABLE_TH_LEFT_CLASS} sticky left-0 z-10 bg-[#F8FAFC]\`}>{t('type')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('avgPct')}</th>
                  {grid.dates.map((d) => (
                    <th key={d} className={\`\${DATA_TABLE_TH_LEFT_CLASS} whitespace-nowrap\`}>
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.roomTypeId} className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} sticky left-0 z-10 bg-white font-medium\`}>
                      {row.code}
                      <span className="block text-[#7F8C8D]">{row.name}</span>
                    </td>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{row.avgOccupancyPct}%</td>
                    {row.cells.map((c) => (
                      <td
                        key={c.date}
                        className={\`\${DATA_TABLE_TD_CLASS} whitespace-nowrap text-center \${cellClass(c.available)}\`}
                        title={t('soldTitle', { sold: c.sold, total: c.total })}
                      >
                        {c.sold}/{c.total}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      )}
    </>
  );
}

export default function OccupancyReportPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<div className="p-8 text-[#7F8C8D]">{tc('loading')}</div>}>
      <OccupancyContent />
    </Suspense>
  );
}
`,
);

writeUtf8(
  'app/reports/reconciliation/page.tsx',
  `'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReconciliationPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [dateDraft, setDateDraft] = useState(todayIso);
  const [date, setDate] = useState(todayIso);
  const [report, setReport] = useState<{
    matched: boolean;
    totalDelta: number;
    folioTotal: number;
    e1Total: number;
    lines: { revenueCode: string; folioAmount: number; e1Amount: number; delta: number }[];
  } | null>(null);

  async function load(forDate: string = date) {
    try {
      const res = await fetch(\`/api/reports/reconciliation?businessDate=\${forDate}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setReport(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('reconciliationTitle')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          setDate(dateDraft);
          void load(dateDraft);
        }}
        onReset={() => {
          const d = todayIso();
          setDateDraft(d);
          setDate(d);
          setReport(null);
        }}
      >
        <DatePicker
          label={tc('date')}
          value={dateDraft}
          onChange={setDateDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      {report && (
        <>
          <p className={\`mb-4 text-[13px] \${report.matched ? 'text-[#2980B9]' : 'text-amber-800'}\`}>
            {t('compareSummary', {
              folio: report.folioTotal.toFixed(2),
              e1: report.e1Total.toFixed(2),
              delta: report.totalDelta.toFixed(2),
            })}
          </p>
          <PageSection className="p-0">
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>Folio</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>E1</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t('delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l) => (
                    <tr key={l.revenueCode} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{l.revenueCode}</td>
                      <td className={\`\${DATA_TABLE_TD_CLASS} text-right font-mono\`}>{l.folioAmount.toFixed(2)}</td>
                      <td className={\`\${DATA_TABLE_TD_CLASS} text-right font-mono\`}>{l.e1Amount.toFixed(2)}</td>
                      <td className={\`\${DATA_TABLE_TD_CLASS} text-right font-mono\`}>{l.delta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageSection>
        </>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/invoices/page.tsx',
  `'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface InvoiceRow {
  id: string;
  invoiceNumber: string | null;
  folioType: string;
  amount: number;
  fiscalStatus: string;
  integrateToAccounting: boolean;
  guestName: string;
  agencyName: string | null;
  reservationId: string;
  createdAt: string;
}

export default function InvoicesReportPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [integrateDraft, setIntegrateDraft] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [integrateOnly, setIntegrateOnly] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);

  async function load(opts?: { from?: string; to?: string; integrateOnly?: boolean }) {
    const f = opts?.from ?? from;
    const t0 = opts?.to ?? to;
    const integ = opts?.integrateOnly ?? integrateOnly;
    try {
      const qs = new URLSearchParams();
      if (f) qs.set('from', f);
      if (t0) qs.set('to', t0);
      if (integ) qs.set('integrateOnly', '1');
      const res = await fetch(\`/api/reports/invoices?\${qs}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function toggleIntegrate(id: string, value: boolean) {
    try {
      const res = await fetch(\`/api/reports/invoices/\${id}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrateToAccounting: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('invoicesTitle')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          setFrom(fromDraft);
          setTo(toDraft);
          setIntegrateOnly(integrateDraft);
          void load({ from: fromDraft, to: toDraft, integrateOnly: integrateDraft });
        }}
        onReset={() => {
          setFromDraft('');
          setToDraft('');
          setIntegrateDraft(false);
          setFrom('');
          setTo('');
          setIntegrateOnly(false);
          void load({ from: '', to: '', integrateOnly: false });
        }}
        actionsExtra={
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={integrateDraft}
              onChange={(e) => setIntegrateDraft(e.target.checked)}
            />
            {t('integrateOnly')}
          </label>
        }
      >
        <DatePicker
          label={tc('from')}
          value={fromDraft}
          onChange={setFromDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={toDraft}
          onChange={setToDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      <FinanceBoundaryBanner target="salesInvoices" />

      <PageSection className="p-0">
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('invoiceNumber')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('folioType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('integrateToAccounting')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('guest')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link href={\`/folio/\${row.reservationId}\`} className="text-sky-600 hover:underline">
                      {row.invoiceNumber ?? row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.folioType}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.amount.toFixed(2)} {tc('azn')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.fiscalStatus}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <input
                      type="checkbox"
                      className={MODAL_CHECKBOX_CLASS}
                      checked={row.integrateToAccounting}
                      onChange={(e) => void toggleIntegrate(row.id, e.target.checked)}
                    />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.guestName}
                    {row.agencyName ? \` · \${row.agencyName}\` : ''}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>
                    {t('noInvoices')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  );
}
`,
);

console.log('part3a ready');
