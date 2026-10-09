'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  DANGER_BUTTON_CLASS,
  FxEquivalentBadge,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { FolioChargeModal } from '@/components/folio/FolioChargeModal';
import { FolioCheckoutModal } from '@/components/folio/FolioCheckoutModal';
import { FolioInvoiceModal } from '@/components/folio/FolioInvoiceModal';
import {
  FolioCloseModal,
  FolioPayLineModal,
  FolioRefundModal,
  FolioVoidModal,
} from '@/components/folio/FolioLineModals';
import { FolioPaymentModal } from '@/components/folio/FolioPaymentModal';
import { ReservationCardAuthorizationsPanel } from '@/components/reservation-card/ReservationCardAuthorizationsPanel';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { accountBalance, type FolioParty, type PayerGuest } from '@/lib/folio-payer';
import type { FolioSubTab, PaxRow } from './types';

export type FolioAccount = {
  id: string;
  type: string;
  status: string;
  reservationGuestId?: string | null;
  charges: Array<{
    id: string;
    amount: number | string;
    qty?: number | null;
    description?: string;
    businessDate?: string;
    paxNo?: number | null;
    invoiceRef?: string | null;
    revenueCode?: { code: string };
  }>;
  payments?: Array<{
    id?: string;
    amount: number | string;
    paymentMethod: string;
    kind?: string | null;
  }>;
};

type LedgerRow = Record<string, unknown> & {
  id: string;
  folioId: string;
  folioType: string;
  folioStatus: string;
  kind: 'charge' | 'payment';
  description: string;
  code: string;
  amount: number;
  paxNo?: number | null;
  chargeId?: string;
  paymentId?: string;
  paymentKind?: string | null;
};

const FOLIO_CHIPS: FolioSubTab[] = ['all', 'guest', 'agency', 'company'];

function paxLabel(row: PaxRow, fallback: string): string {
  const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

function partyOf(tab: FolioSubTab): FolioParty {
  if (tab === 'agency') return 'agency';
  if (tab === 'company') return 'company';
  return 'guest';
}

/** On-card folio: the ledger, plus payment / charge / invoice / checkout modals. */
export function ReservationCardFolioTab({
  reservationId,
  folioTab,
  accounts,
  pax = [],
  displayCurrency = 'AZN',
  canPostCharges = false,
  canCheckOut = false,
  fiscalDocuments = [],
  onFolioTab,
  onChanged,
}: {
  reservationId: string;
  folioTab: FolioSubTab;
  accounts: FolioAccount[];
  pax?: PaxRow[];
  displayCurrency?: string;
  canPostCharges?: boolean;
  canCheckOut?: boolean;
  fiscalDocuments?: Array<{
    id: string;
    invoiceNumber?: string | null;
    fiscalStatus: string;
    rejectionReason?: string | null;
  }>;
  onFolioTab: (tab: FolioSubTab) => void;
  onChanged?: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tf = useTranslations('folio');
  const tc = useTranslations('common');
  const tFiscal = useTranslations('fiscalStatus');
  const { can } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [payLineId, setPayLineId] = useState<string | null>(null);
  const [refund, setRefund] = useState<{ id: string; max: number; folioStatus: string } | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);

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
  const payers: PayerGuest[] = namedPax.map((x) => ({
    id: x.row.id ?? `pax-${x.idx}`,
    name: x.label,
    isPrimary: x.row.isPrimary,
    ownsFolio: Boolean(x.row.ownsFolio),
  }));

  const ledger = useMemo(() => {
    const rows: LedgerRow[] = [];
    for (const folio of accounts) {
      if (folioTab === 'guest' && folio.type !== 'GUEST') continue;
      if (folioTab === 'agency' && folio.type !== 'AGENCY') continue;
      if (folioTab === 'company' && folio.type !== 'COMPANY') continue;
      for (const charge of folio.charges) {
        rows.push({
          id: charge.id,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'charge',
          description: charge.description ?? '—',
          code: charge.revenueCode?.code ?? '—',
          amount: Number(charge.amount) * (charge.qty == null ? 1 : Number(charge.qty)),
          paxNo: charge.paxNo,
          chargeId: charge.id,
        });
      }
      for (const payment of folio.payments ?? []) {
        if (!payment.id) continue;
        rows.push({
          id: `pay-${payment.id}`,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'payment',
          description: payment.kind === 'REFUND' ? tf('refund') : tf('ledgerPayment'),
          code: payment.paymentMethod,
          amount: payment.kind === 'REFUND' ? Number(payment.amount) : -Number(payment.amount),
          paymentId: payment.id,
          paymentKind: payment.kind,
        });
      }
    }
    return rows;
  }, [accounts, folioTab, tf]);

  const closable = accounts.filter((f) => {
    if (f.status !== 'OPEN') return false;
    if (Math.abs(accountBalance(f)) >= 0.01) return false;
    if (folioTab === 'guest') return f.type === 'GUEST';
    if (folioTab === 'agency') return f.type === 'AGENCY';
    if (folioTab === 'company') return f.type === 'COMPANY';
    return true;
  });

  const columns: EraDataGridColumn<LedgerRow>[] = useMemo(() => {
    const cols: EraDataGridColumn<LedgerRow>[] = [
      { key: 'folioType', header: t('folioType'), render: (row) => row.folioType },
      { key: 'code', header: t('department'), render: (row) => row.code },
      { key: 'description', header: t('folioDesc'), render: (row) => row.description },
      {
        key: 'amount',
        header: t('amount'),
        className: 'text-right font-mono',
        render: (row) => `${row.amount.toFixed(2)} ${displayCurrency}`,
      },
      {
        key: 'actions',
        header: tf('actions'),
        render: (row) => (
          <span className="flex flex-wrap gap-1">
            {row.kind === 'charge' && can(PERMISSIONS.FOLIO_VOID) ? (
              <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setVoidId(row.chargeId ?? null)}>
                {tf('void')}
              </button>
            ) : null}
            {row.kind === 'charge' && can(PERMISSIONS.FOLIO_PAYMENT) && row.folioType === 'GUEST' && row.folioStatus === 'OPEN' ? (
              <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setPayLineId(row.chargeId ?? null)}>
                {tf('pay')}
              </button>
            ) : null}
            {row.kind === 'payment' && can(PERMISSIONS.FOLIO_PAYMENT) && row.paymentKind !== 'REFUND' && row.paymentId ? (
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                onClick={() =>
                  setRefund({
                    id: row.paymentId!,
                    max: Math.abs(row.amount),
                    folioStatus: row.folioStatus,
                  })
                }
              >
                {tf('refund')}
              </button>
            ) : null}
          </span>
        ),
      },
    ];
    if (displayCurrency !== 'AZN') {
      cols.splice(4, 0, {
        key: 'fxAzn',
        header: t('fxEquivalentAzn'),
        className: 'text-right',
        render: (row) => (
          <FxEquivalentBadge amount={Math.abs(row.amount)} currencyCode={displayCurrency} label={t('fxApprox')} />
        ),
      });
    }
    return cols;
  }, [can, displayCurrency, t, tf]);

  const cashBar = (
    <div className="flex flex-wrap gap-2">
      {canPostCharges && can(PERMISSIONS.FOLIO_CHARGE) ? (
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setChargeOpen(true)}>
          {t('posting')}
        </button>
      ) : (
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled title={t('postingAfterCheckIn')}>
          {t('posting')}
        </button>
      )}
      {can(PERMISSIONS.FOLIO_PAYMENT) ? (
        <button type="button" className={DANGER_BUTTON_CLASS} onClick={() => setPayOpen(true)}>
          {t('getPayment')}
        </button>
      ) : null}
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setInvoiceOpen(true)}>
        {t('invoice')}
      </button>
      {canCheckOut && can(PERMISSIONS.RESERVATIONS_CHECKOUT) ? (
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCheckoutOpen(true)}>
          {tf('checkOut')}
        </button>
      ) : null}
    </div>
  );

  function renderGrid(rows: LedgerRow[]) {
    if (rows.length === 0) {
      return <p className={`m-0 py-2 text-center text-[12px] ${TEXT_MUTED_CLASS}`}>{tc('empty')}</p>;
    }
    return (
      <HotelDataGrid<LedgerRow>
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

  const modals = (
    <>
      <FolioPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onDone={onChanged}
        reservationId={reservationId}
        party={partyOf(folioTab)}
        guests={payers}
      />
      <FolioChargeModal
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        onDone={onChanged}
        reservationId={reservationId}
      />
      <FolioInvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        onDone={onChanged}
        folios={accounts}
      />
      <FolioCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onDone={onChanged}
        reservationId={reservationId}
        folios={accounts}
      />
      <FolioVoidModal open={Boolean(voidId)} chargeId={voidId} onClose={() => setVoidId(null)} onDone={onChanged} />
      <FolioPayLineModal
        open={Boolean(payLineId)}
        chargeId={payLineId}
        onClose={() => setPayLineId(null)}
        onDone={onChanged}
      />
      <FolioRefundModal open={Boolean(refund)} payment={refund} onClose={() => setRefund(null)} onDone={onChanged} />
      <FolioCloseModal open={Boolean(closeId)} folioId={closeId} onClose={() => setCloseId(null)} onDone={onChanged} />
    </>
  );

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

      {ledger.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-[#D5DADF] bg-[#F8FAFC] px-4 py-6 text-center"
          data-testid="folio-empty-state"
        >
          <p className={`m-0 text-[13px] ${TEXT_MUTED_CLASS}`}>{t('folioEmptyHint')}</p>
          {namedPax.length > 1 ? (
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
      ) : namedPax.length > 1 && (folioTab === 'guest' || folioTab === 'all') ? (
        <div className="space-y-3" data-testid="folio-guest-sections">
          {namedPax.map((g) => {
            const paxNo = g.idx + 1;
            const rows = ledger.filter(
              (row) =>
                row.kind === 'charge' &&
                row.folioType === 'GUEST' &&
                (Number(row.paxNo ?? 0) === paxNo ||
                  (g.idx === 0 && (row.paxNo == null || Number(row.paxNo) === 0))),
            );
            return (
              <div key={g.idx} className={SUBSECTION_SURFACE_CLASS}>
                <p className="m-0 mb-2 text-[12px] font-semibold text-[#34495E]">{g.label}</p>
                {renderGrid(rows)}
              </div>
            );
          })}
          {(() => {
            const rest = ledger.filter(
              (row) => row.kind === 'payment' || (folioTab === 'all' && row.kind === 'charge' && row.folioType !== 'GUEST'),
            );
            return rest.length > 0 ? renderGrid(rest) : null;
          })()}
          {cashBar}
        </div>
      ) : (
        <>
          {renderGrid(ledger)}
          {cashBar}
        </>
      )}

      {fiscalDocuments.length > 0 ? (
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-2 text-[13px]">
          <p className="m-0 font-semibold text-[#34495E]">{tf('fiscalTitle')}</p>
          {fiscalDocuments.map((doc) => (
            <p key={doc.id} className="m-0 text-[#34495E]">
              {doc.invoiceNumber ?? doc.id.slice(0, 8)} — {tFiscal(doc.fiscalStatus as 'PENDING')}
              {doc.rejectionReason ? ` — ${doc.rejectionReason}` : ''}
            </p>
          ))}
        </div>
      ) : null}

      {closable.length > 0 && can(PERMISSIONS.FOLIO_PAYMENT) ? (
        <div className="flex flex-wrap gap-2">
          {closable.map((f) => (
            <button key={f.id} type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCloseId(f.id)}>
              {tf('closeFolio')} · {f.type}
            </button>
          ))}
        </div>
      ) : null}

      <FinanceBoundaryBanner target="salesInvoices" />
      {modals}
    </div>
  );
}
