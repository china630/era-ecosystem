'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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

export default function AgencyLedgerPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);

  useEffect(() => {
    fetch('/api/agencies').then((r) => r.json()).then(setAgencies);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/reports/agency-cl-summary?from=${from}&to=${to}`);
      if (res.ok) setSummary(await res.json());
    })();
  }, [from, to]);

  async function load() {
    if (!agencyId) return;
    const res = await fetch(`/api/agencies/${agencyId}/ledger?from=${from}&to=${to}`);
    if (res.ok) setLedger(await res.json());
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader
        title={t('agencyLedgerTitle')}
        leading={
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={MODAL_INPUT_CLASS} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={MODAL_INPUT_CLASS} />
          </>
        }
      />

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
                  <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noAgencies')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageHeader
        title={t('agencyDetail')}
        leading={
          <select className={MODAL_INPUT_CLASS} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
            <option value="">{t('agencySelect')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        }
        actions={
          <button type="button" onClick={load} className={PRIMARY_BUTTON_CLASS}>
            {tc('load')}
          </button>
        }
      />

      {ledger && (
        <PageSection className="p-0">
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <tbody>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{t('opening')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ledger.opening.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{t('newCharges')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ledger.newCharges.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{t('payments')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ledger.payments.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{t('cashPaid')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ledger.cashPaid.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{t('netAmount')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ledger.netAmount.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>{t('cityLedger')}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                    {ledger.cityLedger.toFixed(2)} {tc('azn')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </PageSection>
      )}
    </AppShell>
  );
}
