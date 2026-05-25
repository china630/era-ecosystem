'use client';

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
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [integrateOnly, setIntegrateOnly] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (integrateOnly) qs.set('integrateOnly', '1');
    const res = await fetch(`/api/reports/invoices?${qs}`);
    if (res.ok) setRows(await res.json());
  }

  useEffect(() => {
    void (async () => {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (integrateOnly) qs.set('integrateOnly', '1');
      const res = await fetch(`/api/reports/invoices?${qs}`);
      if (res.ok) setRows(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only; filters applied via Load button
  }, []);

  async function toggleIntegrate(id: string, value: boolean) {
    const res = await fetch(`/api/reports/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrateToAccounting: value }),
    });
    if (res.ok) await load();
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-5xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-5xl">
      <PageHeader
        title={t('invoicesTitle')}
        leading={
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={MODAL_INPUT_CLASS} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={MODAL_INPUT_CLASS} />
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={integrateOnly}
                onChange={(e) => setIntegrateOnly(e.target.checked)}
              />
              {t('integrateOnly')}
            </label>
          </>
        }
        actions={
          <button type="button" onClick={load} className={PRIMARY_BUTTON_CLASS}>
            {tc('load')}
          </button>
        }
      />

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
                    <Link href={`/folio/${row.reservationId}`} className="text-sky-600 hover:underline">
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
                    {row.agencyName ? ` · ${row.agencyName}` : ''}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noInvoices')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </AppShell>
  );
}
