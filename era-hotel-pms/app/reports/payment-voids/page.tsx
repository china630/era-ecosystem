'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, TEXT_MUTED_CLASS } from '@era/satellite-kit/ui';

type VoidRow = {
  id: string;
  amount: number | string;
  paymentMethod: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  businessDate?: string;
  folio?: {
    type?: string;
    reservation?: {
      id?: string;
      guest?: { fullName?: string | null };
      room?: { roomNumber?: string | null } | null;
    };
  };
};

export default function PaymentVoidsPage() {
  const t = useTranslations('folio');
  const tList = useTranslations('reservationList');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<VoidRow[]>([]);

  useEffect(() => {
    void fetch('/api/reports/payment-voids')
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => {
        const list = (body?.data ?? body) as VoidRow[];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <PageHeader title={t('deletePaymentTitle')} />
      {rows.length === 0 ? (
        <p className={TEXT_MUTED_CLASS}>{t('deletePaymentHint')}</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#D5DADF] text-left">
              <th className="p-2">{t('voidWhen')}</th>
              <th className="p-2">{tList('room')}</th>
              <th className="p-2">{tList('guest')}</th>
              <th className="p-2">{t('method')}</th>
              <th className="p-2 text-right">{tc('amount')}</th>
              <th className="p-2">{t('refundReason')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#D5DADF]">
                <td className="p-2">{row.voidedAt?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                <td className="p-2">{row.folio?.reservation?.room?.roomNumber ?? '—'}</td>
                <td className="p-2">{row.folio?.reservation?.guest?.fullName ?? '—'}</td>
                <td className="p-2">{row.paymentMethod}</td>
                <td className="p-2 text-right font-mono">{Number(row.amount).toFixed(2)}</td>
                <td className="p-2">{row.voidReason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
