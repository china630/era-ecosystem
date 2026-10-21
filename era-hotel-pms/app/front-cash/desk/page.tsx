'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { CashJournalPanel } from '@/components/front-cash/CashJournalPanel';
import { EraModal } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  payingDepartment: string;
  payingDepartmentName?: string;
  tender: string;
  tenderName?: string;
  userLabel: string;
  currency: string;
  moneyTaken: number;
  folioTaken: number;
  exchangeToken: number;
  folioGiven: number;
  exchangeGiven: number;
  moneyGiven: number;
  balance: number;
  closedAt: string | null;
};

function money(n: number) {
  return n.toFixed(2);
}

export default function FrontCashDeskPage() {
  const { can } = useAuth();
  const t = useTranslations('frontCashDesk');
  const tc = useTranslations('common');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [journal, setJournal] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(date ? `/api/front-cash/desk?date=${date}` : '/api/front-cash/desk');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      if (!date && typeof data.date === 'string') setDate(data.date);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeRow(row: Row) {
    setBusy(true);
    try {
      const res = await fetch('/api/front-cash/desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          payingDepartment: row.payingDepartment,
          tender: row.tender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      showSuccess(t('closed'));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const list: { code: string; name: string; rows: Row[]; total: number }[] = [];
    for (const row of rows) {
      let group = list.find((item) => item.code === row.payingDepartment);
      if (!group) {
        group = {
          code: row.payingDepartment,
          name: row.payingDepartmentName ?? row.payingDepartment,
          rows: [],
          total: 0,
        };
        list.push(group);
      }
      group.rows.push(row);
      group.total += row.balance;
    }
    return list;
  }, [rows]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.SCREEN_FRONT_CASH)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setDate('')}>
        <DatePicker
          label={tc('date')}
          value={date}
          onChange={setDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('department')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('tender')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('user')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('currency')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('moneyTaken')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('folioTaken')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('moneyGiven')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('balance')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('closeTime')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={9}>
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <Fragment key={group.code}>
                    <tr className="bg-[#E8EEF2]">
                      <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                        {group.name}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>{money(group.total)}</td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr
                        key={`${row.payingDepartment}-${row.tender}`}
                        className={DATA_TABLE_TR_CLASS}
                        onDoubleClick={() => setJournal(row)}
                      >
                        <td className={DATA_TABLE_TD_CLASS} />
                        <td className={DATA_TABLE_TD_CLASS}>{row.tenderName ?? row.tender}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.userLabel}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.currency}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{money(row.moneyTaken)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{money(row.folioTaken)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{money(row.moneyGiven)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{money(row.balance)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.closedAt ? (
                            bakuDateTimeDisplay(row.closedAt)
                          ) : can(PERMISSIONS.CASH_SHIFT) ? (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBF5FB]"
                              disabled={busy}
                              aria-label={t('close')}
                              title={t('close')}
                              onClick={(event) => {
                                event.stopPropagation();
                                void closeRow(row);
                              }}
                            >
                              <Lock className="h-4 w-4" aria-hidden />
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <EraModal
        open={journal != null}
        onClose={() => setJournal(null)}
        title={journal ? `${journal.payingDepartmentName ?? journal.payingDepartment} · ${journal.tenderName ?? journal.tender}` : t('journalTitle')}
      >
        {journal && date ? (
          <CashJournalPanel date={date} cashPoint={journal.payingDepartment} tender={journal.tender} />
        ) : null}
      </EraModal>
    </>
  );
}
