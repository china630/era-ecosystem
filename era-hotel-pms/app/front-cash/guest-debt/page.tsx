'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, TEXT_MUTED_CLASS } from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';

type DebtRow = {
  id: string;
  createdAt: string;
  amount: number | string;
  note: string;
  reservationId: string;
  guestName: string | null;
  roomNumber: string | null;
  actor: string | null;
};

export default function GuestDebtJournalPage() {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<DebtRow[]>([]);

  useEffect(() => {
    void fetch('/api/front-cash/guest-debt')
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => {
        const list = (body?.data ?? body) as DebtRow[];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <PageHeader title={t('guestDebtJournal')} />
      <p className={TEXT_MUTED_CLASS}>{t('guestDebtHint')}</p>
      {rows.length === 0 ? (
        <p className={TEXT_MUTED_CLASS}>{t('guestDebtEmpty')}</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#D5DADF] text-left">
              <th className="p-2">{t('debtWhen')}</th>
              <th className="p-2">{t('debtGuest')}</th>
              <th className="p-2">{t('debtRoom')}</th>
              <th className="p-2 text-right">{tc('amount')}</th>
              <th className="p-2">{t('guestDebtNote')}</th>
              <th className="p-2">{t('debtCashier')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#D5DADF]">
                <td className="p-2">{bakuDateTimeDisplay(row.createdAt)}</td>
                <td className="p-2">{row.guestName ?? '—'}</td>
                <td className="p-2">{row.roomNumber ?? '—'}</td>
                <td className="p-2 text-right font-mono">{Number(row.amount).toFixed(2)}</td>
                <td className="p-2">{row.note}</td>
                <td className="p-2">{row.actor ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
