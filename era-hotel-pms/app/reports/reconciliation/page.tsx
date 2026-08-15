'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
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
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReconciliationPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [date, setDate] = useState(todayIso);
  const [report, setReport] = useState<{
    matched: boolean;
    totalDelta: number;
    folioTotal: number;
    e1Total: number;
    lines: { revenueCode: string; folioAmount: number; e1Amount: number; delta: number }[];
  } | null>(null);

  const load = useCallback(async (forDate: string) => {
    try {
      const res = await fetch(`/api/reports/reconciliation?businessDate=${forDate}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setReport(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('reconciliationTitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setDate(todayIso());
          setReport(null);
        }}
      >
        <DatePicker
          label={tc('date')}
          value={date}
          onChange={setDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      {report && (
        <>
          <p className={`mb-4 text-[13px] ${report.matched ? 'text-[#2980B9]' : 'text-amber-800'}`}>
            {t('compareSummary', {
              folio: report.folioTotal.toFixed(2),
              e1: report.e1Total.toFixed(2),
              delta: report.totalDelta.toFixed(2),
            })}
          </p>
          <section className={`${CARD_CONTAINER_CLASS} p-4 p-0`}>
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
          </section>
        </>
      )}
    </>
  );
}
