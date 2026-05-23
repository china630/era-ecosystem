'use client';

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
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function ReconciliationPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<{
    matched: boolean;
    totalDelta: number;
    folioTotal: number;
    e1Total: number;
    lines: { revenueCode: string; folioAmount: number; e1Amount: number; delta: number }[];
  } | null>(null);

  async function load() {
    const res = await fetch(`/api/reports/reconciliation?businessDate=${date}`);
    if (res.ok) setReport(await res.json());
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
        title={t('reconciliationTitle')}
        leading={
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={MODAL_INPUT_CLASS} />
        }
        actions={
          <button type="button" onClick={load} className={PRIMARY_BUTTON_CLASS}>
            {tc('compare')}
          </button>
        }
      />

      {report && (
        <>
          <p className={`mb-4 text-[13px] ${report.matched ? 'text-[#2980B9]' : 'text-amber-800'}`}>
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
                      <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{l.folioAmount.toFixed(2)}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{l.e1Amount.toFixed(2)}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{l.delta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageSection>
        </>
      )}
    </AppShell>
  );
}
