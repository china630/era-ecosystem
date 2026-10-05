'use client';

import { useCallback, useEffect, useState } from 'react';
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
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  payingDepartment: string;
  tender: string;
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
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/front-cash/desk?date=${date}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
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

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.SCREEN_FRONT_CASH)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setDate(hotelDateKey())}>
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('exchangeToken')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('folioGiven')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('exchangeGiven')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('moneyGiven')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('balance')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('closeTime')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={12}>
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.payingDepartment}-${row.tender}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.payingDepartment}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.tender}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.userLabel}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.currency}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.moneyTaken)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.folioTaken)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.exchangeToken)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.folioGiven)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.exchangeGiven)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.moneyGiven)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.balance)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.closedAt ? (
                        bakuDateTimeDisplay(row.closedAt)
                      ) : can(PERMISSIONS.CASH_SHIFT) ? (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => void closeRow(row)}
                        >
                          {t('close')}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
