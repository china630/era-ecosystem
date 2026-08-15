'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  DANGER_BUTTON_CLASS,
  FxEquivalentBadge,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { ReservationCardAuthorizationsPanel } from '@/components/reservation-card/ReservationCardAuthorizationsPanel';
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

type FolioGridRow = FolioLine & Record<string, unknown>;

export function ReservationCardFolioTab({
  reservationId,
  folioTab,
  lines,
  displayCurrency = 'AZN',
  onFolioTab,
}: {
  reservationId: string;
  folioTab: FolioSubTab;
  lines: FolioLine[];
  /** Reservation pricing currency for display-only AZN equivalent (HT-FX-01). */
  displayCurrency?: string;
  onFolioTab: (tab: FolioSubTab) => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');

  const filtered = useMemo(() => {
    if (folioTab === 'all') return lines;
    if (folioTab === 'agency') return lines.filter((l) => l.folioType === 'AGENCY');
    if (folioTab === 'guest' || folioTab === 'first') {
      return lines.filter((l) => l.folioType === 'GUEST');
    }
    return lines.filter((l) => l.folioType === 'COMPANY');
  }, [folioTab, lines]);

  const rows: FolioGridRow[] = useMemo(
    () => filtered.map((l) => ({ ...l })),
    [filtered],
  );

  const columns: EraDataGridColumn<FolioGridRow>[] = useMemo(() => {
    const cols: EraDataGridColumn<FolioGridRow>[] = [
      {
        key: 'stayDate',
        header: t('folioDate'),
        render: (row) => row.stayDate ?? '—',
      },
      {
        key: 'paxNo',
        header: t('folioPax'),
        className: 'text-center',
        render: (row) => String(row.paxNo ?? '—'),
      },
      {
        key: 'invoiceRef',
        header: t('folioInvoice'),
        render: (row) => row.invoiceRef ?? '—',
      },
      {
        key: 'department',
        header: t('department'),
        render: (row) => row.revenueCode?.code ?? '—',
      },
      {
        key: 'description',
        header: t('folioDesc'),
        render: (row) => row.description ?? '—',
      },
      {
        key: 'amount',
        header: t('amount'),
        className: 'text-right font-mono',
        render: (row) => `${Number(row.amount).toFixed(2)} ${displayCurrency}`,
      },
    ];
    if (displayCurrency !== 'AZN') {
      cols.push({
        key: 'fxAzn',
        header: t('fxEquivalentAzn'),
        className: 'text-right',
        render: (row) => (
          <FxEquivalentBadge
            amount={Number(row.amount)}
            currencyCode={displayCurrency}
            label={t('fxApprox')}
          />
        ),
      });
    }
    return cols;
  }, [displayCurrency, t]);

  return (
    <div className="space-y-3">
      <ReservationCardAuthorizationsPanel reservationId={reservationId} />
      <div className={CHIP_GROUP_CLASS} role="tablist">
        {(['all', 'first', 'second', 'agency', 'guest'] as FolioSubTab[]).map((st) => (
          <button
            key={st}
            type="button"
            role="tab"
            aria-selected={folioTab === st}
            className={folioTab === st ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            onClick={() => onFolioTab(st)}
          >
            {t(`folioTab.${st}`)}
          </button>
        ))}
      </div>
      <HotelDataGrid<FolioGridRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage={tc('empty')}
        defaultPageSize={25}
      />
      <div className="flex flex-wrap gap-2">
        <Link href={`/folio/${reservationId}`} className={PRIMARY_BUTTON_CLASS}>
          {t('posting')}
        </Link>
        <Link href={`/folio/${reservationId}?action=payment`} className={DANGER_BUTTON_CLASS}>
          {t('getPayment')}
        </Link>
        <Link href={`/folio/${reservationId}?action=invoice`} className={SECONDARY_BUTTON_CLASS}>
          {t('invoice')}
        </Link>
      </div>
      <FinanceBoundaryBanner target="salesInvoices" />
    </div>
  );
}
