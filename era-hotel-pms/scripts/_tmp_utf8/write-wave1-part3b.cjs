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
  'app/reports/agency-ledger/page.tsx',
  `'use client';

import { useEffect, useState } from 'react';
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
  FieldSelect,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Agency {
  id: string;
  code: string;
  name: string;
}

interface Ledger {
  opening: number;
  newCharges: number;
  payments: number;
  cashPaid: number;
  netAmount: number;
  cityLedger: number;
  closing: number;
  reservationCount: number;
}

interface SummaryRow {
  agencyId: string;
  agencyCode: string;
  agencyName: string;
  cityLedger: number;
  cashPaid: number;
  netAmount: number;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgencyLedgerPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyIdDraft, setAgencyIdDraft] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [fromDraft, setFromDraft] = useState(todayIso);
  const [toDraft, setToDraft] = useState(todayIso);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/agencies');
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setAgencies(Array.isArray(data) ? data : []);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [tc]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(\`/api/reports/agency-cl-summary?from=\${from}&to=\${to}\`);
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setSummary(Array.isArray(data) ? data : []);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [from, to, tc]);

  async function loadDetail(id: string, f: string, t0: string) {
    if (!id) return;
    try {
      const res = await fetch(\`/api/agencies/\${id}/ledger?from=\${f}&to=\${t0}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setLedger(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('agencyLedgerTitle')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          setFrom(fromDraft);
          setTo(toDraft);
          setAgencyId(agencyIdDraft);
          void loadDetail(agencyIdDraft, fromDraft, toDraft);
        }}
        onReset={() => {
          const d = todayIso();
          setFromDraft(d);
          setToDraft(d);
          setFrom(d);
          setTo(d);
          setAgencyIdDraft('');
          setAgencyId('');
          setLedger(null);
        }}
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
        <FieldSelect
          label={t('agency')}
          preset="select"
          value={agencyIdDraft}
          onChange={(e) => setAgencyIdDraft(e.target.value)}
        >
          <option value="">{t('agencySelect')}</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </FieldSelect>
      </EraListFilterBar>

      <FinanceBoundaryBanner target="counterparties" />

      <PageSection className="mb-6 p-0">
        <h2 className="mb-2 px-4 pt-4 text-sm font-semibold text-[#34495E]">{t('agencyClSummary')}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agency')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cityLedger')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cashPaid')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('netAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.agencyId} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.agencyCode} — {row.agencyName}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.cityLedger.toFixed(2)} {tc('azn')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.cashPaid.toFixed(2)} {tc('azn')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.netAmount.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={4} className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>
                    {t('noAgencies')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      {ledger && agencyId ? (
        <>
          <PageHeader title={t('agencyDetail')} />
          <PageSection className="p-0">
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <tbody>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{t('opening')}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {ledger.opening.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{t('newCharges')}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {ledger.newCharges.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{t('payments')}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {ledger.payments.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{t('cashPaid')}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {ledger.cashPaid.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} text-[#7F8C8D]\`}>{t('netAmount')}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {ledger.netAmount.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={\`\${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]\`}>{t('cityLedger')}</td>
                    <td className={\`\${DATA_TABLE_TD_CLASS} font-semibold\`}>
                      {ledger.cityLedger.toFixed(2)} {tc('azn')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </PageSection>
        </>
      ) : null}
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/agency-profitability/page.tsx',
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
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function AgencyProfitContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const defaults = defaultRange();
  const [draft, setDraft] = useState(defaults);
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
      const q = \`from=\${range.from}&to=\${range.to}\`;
      const res = await fetch(\`/api/reports/agency-profitability?\${q}\`);
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
          label={tc('from')}
          value={draft.from}
          onChange={(from) => setDraft((r) => ({ ...r, from }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={draft.to}
          onChange={(to) => setDraft((r) => ({ ...r, to }))}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <PageSection>
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
`,
);

console.log('part3b ready');
