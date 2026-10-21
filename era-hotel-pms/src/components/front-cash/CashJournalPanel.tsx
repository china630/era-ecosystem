'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';

const PAY_METHODS = new Set([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'LOYALTY_POINTS',
  'DEPOSIT',
  'COMPANY_ACCOUNT',
  'EPOINT',
  'CL_AGENCY',
  'CL_COMPANY',
  'GUEST_DEBT',
]);

function journalLineText(
  line: Line,
  t: (key: 'journalRefund' | 'journalDeposit') => string,
  tPay: (key: 'CASH') => string,
) {
  if (line.kind === 'REFUND') return t('journalRefund');
  if (line.kind === 'DEPOSIT') return t('journalDeposit');
  if (line.kind === 'DEBT' || line.kind === 'PENDING') return line.description;
  if (PAY_METHODS.has(line.tender)) return tPay(line.tender as 'CASH');
  if (line.tender.startsWith('terminal:')) return line.tender.slice('terminal:'.length);
  return line.description;
}

type Line = {
  id: string;
  at: string;
  employee: string;
  guestName: string | null;
  roomNumber: string | null;
  reservationId: string | null;
  description: string;
  amount: number;
  kind: string;
  tender: string;
  cashPoint: string;
};

export function CashJournalPanel({
  date,
  cashPoint,
  tender,
  onOpenReservation,
}: {
  date: string;
  cashPoint?: string;
  tender?: string;
  onOpenReservation?: (id: string) => void;
}) {
  const t = useTranslations('frontCashDesk');
  const tPay = useTranslations('paymentMethod');
  const tc = useTranslations('common');
  const [lines, setLines] = useState<Line[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ date });
    if (cashPoint) params.set('cashPoint', cashPoint);
    if (tender) params.set('tender', tender);
    try {
      const res = await fetch(`/api/front-cash/journal?${params}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setLines(Array.isArray(data.lines) ? data.lines : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [cashPoint, date, tc, tender]);

  useEffect(() => {
    if (date) void load();
  }, [date, load]);

  const groups = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const line of lines) {
      const key = line.employee || '—';
      map.set(key, [...(map.get(key) ?? []), line]);
    }
    return [...map.entries()];
  }, [lines]);

  if (lines.length === 0) {
    return <p className="m-0 text-[13px] text-[#7F8C8D]">{t('journalEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('journalWhen')}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('journalGuest')}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('journalRoom')}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('journalText')}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('balance')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([employee, rows]) => (
            <Fragment key={employee}>
              <tr className="bg-[#F4F7F8]">
                <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                  {employee} ({rows.length})
                </td>
              </tr>
              {rows.map((line) => (
                <tr
                  key={line.id}
                  className={DATA_TABLE_TR_CLASS}
                  onDoubleClick={() => {
                    if (line.reservationId && onOpenReservation) onOpenReservation(line.reservationId);
                  }}
                >
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(line.at)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{line.guestName ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{line.roomNumber ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{journalLineText(line, t, tPay)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{Number(line.amount).toFixed(2)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
