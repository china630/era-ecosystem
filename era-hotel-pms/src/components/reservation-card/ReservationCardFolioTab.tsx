'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  DANGER_BUTTON_CLASS,
  FxEquivalentBadge,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { ReservationCardAuthorizationsPanel } from '@/components/reservation-card/ReservationCardAuthorizationsPanel';
import type { FolioSubTab, PaxRow } from './types';

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

const FOLIO_CHIPS: FolioSubTab[] = ['all', 'guest', 'agency', 'company'];

function paxLabel(row: PaxRow, fallback: string): string {
  const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

/** On-card folio chrome — GUEST/AGENCY/COMPANY + per-guest sections when party > 1. */
export function ReservationCardFolioTab({
  reservationId,
  folioTab,
  lines,
  pax = [],
  displayCurrency = 'AZN',
  onFolioTab,
}: {
  reservationId: string;
  folioTab: FolioSubTab;
  lines: FolioLine[];
  pax?: PaxRow[];
  displayCurrency?: string;
  onFolioTab: (tab: FolioSubTab) => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [authOpen, setAuthOpen] = useState(false);

  const namedPax = useMemo(
    () =>
      pax
        .map((row, idx) => ({ row, idx, label: paxLabel(row, t('folioPaxGuest', { n: idx + 1 })) }))
        .filter(
          (x) =>
            Boolean(x.row.guestId) ||
            Boolean(x.row.firstName?.trim()) ||
            Boolean(x.row.lastName?.trim()),
        ),
    [pax, t],
  );
  const multiGuest = namedPax.length > 1;

  const filtered = useMemo(() => {
    if (folioTab === 'all') return lines;
    if (folioTab === 'agency') return lines.filter((l) => l.folioType === 'AGENCY');
    if (folioTab === 'guest') return lines.filter((l) => l.folioType === 'GUEST');
    return lines.filter((l) => l.folioType === 'COMPANY');
  }, [folioTab, lines]);

  const columns: EraDataGridColumn<FolioGridRow>[] = useMemo(() => {
    const cols: EraDataGridColumn<FolioGridRow>[] = [
      {
        key: 'stayDate',
        header: t('folioDate'),
        render: (row) => row.stayDate ?? '—',
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
    if (!multiGuest) {
      cols.splice(1, 0, {
        key: 'paxNo',
        header: t('folioPax'),
        className: 'text-center',
        render: (row) => String(row.paxNo ?? '—'),
      });
    }
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
  }, [displayCurrency, multiGuest, t]);

  const cashBar = (
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
  );

  function renderGrid(rows: FolioGridRow[]) {
    if (rows.length === 0) {
      return (
        <p className={`m-0 py-2 text-center text-[12px] ${TEXT_MUTED_CLASS}`}>{tc('empty')}</p>
      );
    }
    return (
      <HotelDataGrid<FolioGridRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage={tc('empty')}
        defaultPageSize={25}
        embedded
        pagination={false}
        paginationMode="server"
        page={1}
        pageSize={Math.max(rows.length, 1)}
        total={rows.length}
      />
    );
  }

  const showGuestSections =
    multiGuest && (folioTab === 'guest' || folioTab === 'all');

  const guestSections = useMemo(() => {
    if (!showGuestSections) return null;
    return namedPax.map(({ idx, label }) => {
      const paxNo = idx + 1;
      const sectionRows = filtered
        .filter((l) => (folioTab === 'guest' ? true : l.folioType === 'GUEST'))
        .filter(
          (l) =>
            Number(l.paxNo ?? 0) === paxNo ||
            (idx === 0 && (l.paxNo == null || Number(l.paxNo) === 0)),
        )
        .map((l) => ({ ...l }));
      return { key: `pax-${idx}`, label, rows: sectionRows };
    });
  }, [filtered, folioTab, namedPax, showGuestSections]);

  return (
    <div className="space-y-3" data-testid="reservation-folio-tab">
      <div>
        <button
          type="button"
          className={`${SECONDARY_BUTTON_CLASS} text-[12px]`}
          aria-expanded={authOpen}
          onClick={() => setAuthOpen((v) => !v)}
        >
          {authOpen ? t('cardAuth.hide') : t('cardAuth.show')}
        </button>
        {authOpen ? (
          <div className="mt-2">
            <ReservationCardAuthorizationsPanel reservationId={reservationId} />
          </div>
        ) : null}
      </div>

      <div className={CHIP_GROUP_CLASS} role="tablist">
        {FOLIO_CHIPS.map((st) => (
          <button
            key={st}
            type="button"
            role="tab"
            aria-selected={folioTab === st}
            className={folioTab === st ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            data-testid={`folio-chip-${st}`}
            onClick={() => onFolioTab(st)}
          >
            {t(`folioTab.${st}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-[#D5DADF] bg-[#F8FAFC] px-4 py-6 text-center"
          data-testid="folio-empty-state"
        >
          <p className={`m-0 text-[13px] ${TEXT_MUTED_CLASS}`}>{t('folioEmptyHint')}</p>
          {multiGuest ? (
            <div className="mt-3 space-y-2 text-left">
              {namedPax.map((g) => (
                <div key={g.idx} className={SUBSECTION_SURFACE_CLASS}>
                  <p className="m-0 text-[12px] font-semibold text-[#34495E]">{g.label}</p>
                  <p className={`m-0 mt-0.5 text-[11px] ${TEXT_MUTED_CLASS}`}>{t('folioGuestEmpty')}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex justify-center">{cashBar}</div>
        </div>
      ) : showGuestSections && guestSections ? (
        <div className="space-y-3" data-testid="folio-guest-sections">
          {guestSections.map((sec) => (
            <div key={sec.key} className={SUBSECTION_SURFACE_CLASS}>
              <p className="m-0 mb-2 text-[12px] font-semibold text-[#34495E]">{sec.label}</p>
              {renderGrid(sec.rows)}
            </div>
          ))}
          {folioTab === 'all'
            ? renderGrid(
                filtered
                  .filter((l) => l.folioType !== 'GUEST')
                  .map((l) => ({ ...l })),
              )
            : null}
          {cashBar}
        </div>
      ) : (
        <>
          {renderGrid(filtered.map((l) => ({ ...l })))}
          {cashBar}
        </>
      )}

      <FinanceBoundaryBanner target="salesInvoices" />
    </div>
  );
}
