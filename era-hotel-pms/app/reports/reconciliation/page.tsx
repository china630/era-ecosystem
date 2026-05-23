'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('reconciliationTitle')}</h1>
      <div className="mb-4 flex gap-2 text-sm">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" />
        <button type="button" onClick={load} className="rounded bg-sky-700 px-3 py-1">
          {tc('compare')}
        </button>
      </div>
      {report && (
        <>
          <p className={`mb-4 text-sm ${report.matched ? 'text-emerald-300' : 'text-amber-300'}`}>
            {t('compareSummary', {
              folio: report.folioTotal.toFixed(2),
              e1: report.e1Total.toFixed(2),
              delta: report.totalDelta.toFixed(2),
            })}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left">{tc('code')}</th>
                <th>Folio</th>
                <th>E1</th>
                <th>{t('delta')}</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => (
                <tr key={l.revenueCode} className="border-t border-slate-800">
                  <td className="py-1">{l.revenueCode}</td>
                  <td>{l.folioAmount.toFixed(2)}</td>
                  <td>{l.e1Amount.toFixed(2)}</td>
                  <td>{l.delta.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
