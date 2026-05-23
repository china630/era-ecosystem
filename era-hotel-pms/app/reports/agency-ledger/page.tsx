'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
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
  closing: number;
  reservationCount: number;
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

  useEffect(() => {
    fetch('/api/agencies').then((r) => r.json()).then(setAgencies);
  }, []);

  async function load() {
    if (!agencyId) return;
    const res = await fetch(`/api/agencies/${agencyId}/ledger?from=${from}&to=${to}`);
    if (res.ok) setLedger(await res.json());
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-3xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader
        title={t('agencyLedgerTitle')}
        leading={
          <>
            <select className={MODAL_INPUT_CLASS} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">{t('agencySelect')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={MODAL_INPUT_CLASS} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={MODAL_INPUT_CLASS} />
          </>
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
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>{t('closing')}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                    {ledger.closing.toFixed(2)} {tc('azn')}
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
