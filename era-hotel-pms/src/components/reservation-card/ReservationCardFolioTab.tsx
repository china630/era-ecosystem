'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { ReservationCardAuthorizationsPanel } from '@/components/reservation-card/ReservationCardAuthorizationsPanel';
import { PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import type { FolioSubTab } from './types';

type FolioLine = {
  id: string;
  folioType: string;
  amount: number;
  description?: string;
  revenueCode?: { code: string };
  stayDate?: string;
  paxNo?: number | null;
  invoiceRef?: string | null;
};

export function ReservationCardFolioTab({
  reservationId,
  folioTab,
  lines,
  onFolioTab,
}: {
  reservationId: string;
  folioTab: FolioSubTab;
  lines: FolioLine[];
  onFolioTab: (tab: FolioSubTab) => void;
}) {
  const t = useTranslations('reservationCard');

  const filtered =
    folioTab === 'all'
      ? lines
      : folioTab === 'agency'
        ? lines.filter((l) => l.folioType === 'AGENCY')
        : folioTab === 'guest'
          ? lines.filter((l) => l.folioType === 'GUEST')
          : folioTab === 'first'
            ? lines.filter((l) => l.folioType === 'GUEST')
            : lines.filter((l) => l.folioType === 'COMPANY');

  return (
    <div className="space-y-3">
      <ReservationCardAuthorizationsPanel reservationId={reservationId} />
      <div className="flex gap-2">
        {(['all', 'first', 'second', 'agency', 'guest'] as FolioSubTab[]).map((st) => (
          <button
            key={st}
            type="button"
            className={`rounded px-2 py-1 text-[12px] ${folioTab === st ? 'bg-[#2980B9] text-white' : 'bg-[#EBEDF0] text-[#34495E]'}`}
            onClick={() => onFolioTab(st)}
          >
            {t(`folioTab.${st}`)}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] font-mono text-[12px]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="p-2 text-left">{t('folioDate')}</th>
              <th className="p-2 text-center">{t('folioPax')}</th>
              <th className="p-2 text-left">{t('folioInvoice')}</th>
              <th className="p-2 text-left">{t('department')}</th>
              <th className="p-2 text-left">{t('folioDesc')}</th>
              <th className="p-2 text-right">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((line) => (
              <tr key={line.id} className="border-t border-[#D5DADF]">
                <td className="p-2">{line.stayDate ?? '—'}</td>
                <td className="p-2 text-center">{line.paxNo ?? '—'}</td>
                <td className="p-2">{line.invoiceRef ?? '—'}</td>
                <td className="p-2">{line.revenueCode?.code ?? '—'}</td>
                <td className="p-2">{line.description ?? '—'}</td>
                <td className="p-2 text-right">{Number(line.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/folio/${reservationId}`} className={PRIMARY_BUTTON_CLASS}>
          {t('posting')}
        </Link>
        <Link href={`/folio/${reservationId}?action=payment`} className="rounded-lg bg-[#E74C3C] px-4 py-2 text-[13px] font-medium text-white">
          {t('getPayment')}
        </Link>
        <Link href={`/folio/${reservationId}?action=invoice`} className="rounded-lg border border-[#D5DADF] px-4 py-2 text-[13px] font-medium text-[#34495E] hover:bg-[#F8FAFC]">
          {t('invoice')}
        </Link>
      </div>
      <FinanceBoundaryBanner target="salesInvoices" />
    </div>
  );
}
