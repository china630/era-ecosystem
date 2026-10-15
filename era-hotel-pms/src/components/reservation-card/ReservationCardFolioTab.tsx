'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  DANGER_BUTTON_CLASS,
  FxEquivalentBadge,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
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
  FolioDeletePaymentModal,
  FolioMissedNightsModal,
  FolioPayLineModal,
  FolioRefundModal,
  FolioTransferModal,
  FolioVoidModal,
} from '@/components/folio/FolioLineModals';
import { FolioPaymentModal } from '@/components/folio/FolioPaymentModal';
import { displayRoomChargeNote } from '@/lib/folio-charge-note';
import { revenueLabel } from '@/lib/folio-article-summary';
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
    revenueCode?: {
      code: string;
      name?: string | null;
      systemRole?: string | null;
      nameAz?: string | null;
      nameRu?: string | null;
      nameEn?: string | null;
    };
  }>;
  payments?: Array<{
    id?: string;
    amount: number | string;
    paymentMethod: string;
    kind?: string | null;
    voidedAt?: string | null;
    voidReason?: string | null;
    refundReason?: string | null;
    refundOfPaymentId?: string | null;
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
  refundable?: boolean;
  refundMax?: number;
  voidedAt?: string | null;
  voidReason?: string | null;
};

function paxLabel(row: PaxRow, fallback: string): string {
  const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

function FolioRowMenu({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; run: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <span className="relative inline-block">
      <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setOpen((value) => !value)}>
        {label}
      </button>
      {open ? (
        <span className="absolute right-0 z-20 mt-1 flex min-w-[180px] flex-col rounded border border-[#D5DADF] bg-white p-1 shadow">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="px-2 py-1 text-left text-[12px] hover:bg-[#F4F6F7]"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
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
  fiscalDocuments: _fiscalDocuments = [],
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
  const tPay = useTranslations('paymentMethod');
  const locale = useLocale();
  const { can } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [payLineId, setPayLineId] = useState<string | null>(null);
  const [refund, setRefund] = useState<{ id: string; max: number; folioStatus: string } | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [missedOpen, setMissedOpen] = useState(false);
  const [folioFocus, setFolioFocus] = useState<string>('all');

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
      const refunded = new Map<string, number>();
      for (const payment of folio.payments ?? []) {
        if (payment.voidedAt || payment.kind !== 'REFUND' || !payment.refundOfPaymentId) continue;
        refunded.set(
          payment.refundOfPaymentId,
          (refunded.get(payment.refundOfPaymentId) ?? 0) + Number(payment.amount),
        );
      }
      for (const charge of folio.charges) {
        const raw = charge.description ?? '—';
        const note = displayRoomChargeNote(raw, (kind, date) =>
          kind === 'night-audit' ? tf('nightAuditNote', { date }) : tf('manualRoomNote', { date }),
        );
        rows.push({
          id: charge.id,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'charge',
          description: (charge as { serviceReceivedAt?: string | null }).serviceReceivedAt
            ? `${note} · received`
            : note,
          code: revenueLabel(charge.revenueCode, locale),
          amount: Number(charge.amount) * (charge.qty == null ? 1 : Number(charge.qty)),
          paxNo: charge.paxNo,
          chargeId: charge.id,
        });
      }
      for (const payment of folio.payments ?? []) {
        if (!payment.id) continue;
        if (payment.voidedAt) continue;
        const refundMax = Math.max(0, Number(payment.amount) - (refunded.get(payment.id) ?? 0));
        rows.push({
          id: `pay-${payment.id}`,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'payment',
          description: payment.kind === 'REFUND' ? tf('refund') : tf('ledgerPayment'),
          code: tPay(payment.paymentMethod as 'CASH'),
          amount: payment.kind === 'REFUND' ? Number(payment.amount) : -Number(payment.amount),
          paymentId: payment.id,
          paymentKind: payment.kind,
          refundable: payment.kind !== 'REFUND' && refundMax > 0.01,
          refundMax,
        });
      }
    }
    return rows;
  }, [accounts, folioTab, locale, tPay, tf]);

  const deletedRows = useMemo(() => {
    const rows: LedgerRow[] = [];
    for (const folio of accounts) {
      for (const payment of folio.payments ?? []) {
        if (!payment.id || !payment.voidedAt) continue;
        rows.push({
          id: `void-${payment.id}`,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'payment',
          description: payment.voidReason?.trim() || tf('deletePayment'),
          code: payment.paymentMethod,
          amount: -Number(payment.amount),
          paymentId: payment.id,
          paymentKind: payment.kind,
          voidedAt: payment.voidedAt,
          voidReason: payment.voidReason,
        });
      }
    }
    return rows;
  }, [accounts, tf]);

  const focusGuestId = folioFocus.startsWith('guest:') ? folioFocus.slice('guest:'.length) : '';
  const visibleRows = useMemo(() => {
    if (folioFocus === 'deleted') return deletedRows;
    if (folioFocus === 'agency') return ledger.filter((row) => row.folioType === 'AGENCY');
    if (folioFocus === 'company') return ledger.filter((row) => row.folioType === 'COMPANY');
    if (focusGuestId) {
      const folioIds = new Set(
        accounts
          .filter((folio) => folio.type === 'GUEST' && folio.reservationGuestId === focusGuestId)
          .map((folio) => folio.id),
      );
      return ledger.filter((row) => folioIds.has(row.folioId));
    }
    return ledger;
  }, [accounts, deletedRows, focusGuestId, folioFocus, ledger]);

  const closable = accounts.filter((f) => {
    if (f.status !== 'OPEN') return false;
    if (Math.abs(accountBalance(f)) >= 0.01) return false;
    if (folioTab === 'guest') return f.type === 'GUEST';
    if (folioTab === 'agency') return f.type === 'AGENCY';
    if (folioTab === 'company') return f.type === 'COMPANY';
    return true;
  });

  const personalSections = useMemo(() => {
    const personal = accounts
      .filter((folio) => folio.type === 'GUEST' && folio.reservationGuestId)
      .map((folio) => {
        const guest = namedPax.find((row) => row.row.id === folio.reservationGuestId);
        const rows = ledger.filter((row) => row.folioId === folio.id);
        const owns = Boolean(guest?.row.ownsFolio);
        if (!owns && rows.length === 0) return null;
        return { folio, label: guest?.label ?? folio.type, rows };
      })
      .filter((section): section is { folio: FolioAccount; label: string; rows: LedgerRow[] } => section != null);
    const shared = accounts
      .filter((folio) => folio.type === 'GUEST' && !folio.reservationGuestId)
      .map((folio) => ({
        folio,
        label: t('folioTab.guest'),
        rows: ledger.filter((row) => row.folioId === folio.id),
      }))
      .filter((section) => section.rows.length > 0);
    return [...personal, ...shared];
  }, [accounts, ledger, namedPax, t]);

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
          <FolioRowMenu
            label={tf('rowMenu')}
            items={[
              ...(row.kind === 'charge' && can(PERMISSIONS.FOLIO_VOID)
                ? [{ id: 'void', label: tf('void'), run: () => setVoidId(row.chargeId ?? null) }]
                : []),
              ...(row.kind === 'charge' &&
              can(PERMISSIONS.FOLIO_PAYMENT) &&
              row.folioType === 'GUEST' &&
              row.folioStatus === 'OPEN'
                ? [{ id: 'pay', label: tf('pay'), run: () => setPayLineId(row.chargeId ?? null) }]
                : []),
              ...(row.kind === 'charge' && can(PERMISSIONS.FOLIO_CHARGE) && row.folioStatus === 'OPEN'
                ? [{ id: 'transfer', label: tf('transfer'), run: () => setTransferId(row.chargeId ?? null) }]
                : []),
              ...(row.kind === 'payment' && can(PERMISSIONS.FOLIO_VOID) && row.paymentKind !== 'REFUND' && row.paymentId
                ? [{ id: 'delete', label: tf('deletePayment'), run: () => setDeletePaymentId(row.paymentId ?? null) }]
                : []),
              ...(row.kind === 'payment' && can(PERMISSIONS.FOLIO_PAYMENT) && row.refundable && row.paymentId
                ? [
                    {
                      id: 'refund',
                      label: tf('refund'),
                      run: () =>
                        setRefund({
                          id: row.paymentId!,
                          max: row.refundMax ?? Math.abs(row.amount),
                          folioStatus: row.folioStatus,
                        }),
                    },
                  ]
                : []),
            ]}
          />
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
      {can(PERMISSIONS.NIGHT_AUDIT_RUN) ? (
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setMissedOpen(true)}>
          {tf('missedNights')}
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
      />
      <FolioVoidModal open={Boolean(voidId)} chargeId={voidId} onClose={() => setVoidId(null)} onDone={onChanged} />
      <FolioPayLineModal
        open={Boolean(payLineId)}
        chargeId={payLineId}
        onClose={() => setPayLineId(null)}
        onDone={onChanged}
      />
      <FolioRefundModal open={Boolean(refund)} payment={refund} onClose={() => setRefund(null)} onDone={onChanged} />
      <FolioDeletePaymentModal
        open={Boolean(deletePaymentId)}
        paymentId={deletePaymentId}
        onClose={() => setDeletePaymentId(null)}
        onDone={onChanged}
      />
      <FolioTransferModal
        open={Boolean(transferId)}
        chargeId={transferId}
        onClose={() => setTransferId(null)}
        onDone={onChanged}
      />
      <FolioMissedNightsModal
        open={missedOpen}
        reservationId={reservationId}
        onClose={() => setMissedOpen(false)}
        onDone={onChanged}
      />
      <FolioCloseModal open={Boolean(closeId)} folioId={closeId} onClose={() => setCloseId(null)} onDone={onChanged} />
    </>
  );

  return (
    <div className="space-y-3" data-testid="reservation-folio-tab">
      <div className={CHIP_GROUP_CLASS} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={folioFocus === 'all'}
          className={folioFocus === 'all' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
          onClick={() => {
            setFolioFocus('all');
            onFolioTab('all');
          }}
        >
          {t('folioTab.all')}
        </button>
        {namedPax.map((guest) => {
          const id = guest.row.id ?? `idx-${guest.idx}`;
          const key = `guest:${id}`;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={folioFocus === key}
              className={folioFocus === key ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
              onClick={() => {
                setFolioFocus(key);
                onFolioTab('guest');
              }}
            >
              {guest.label}
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={folioFocus === 'agency'}
          className={folioFocus === 'agency' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
          onClick={() => {
            setFolioFocus('agency');
            onFolioTab('agency');
          }}
        >
          {t('folioTab.agency')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={folioFocus === 'company'}
          className={folioFocus === 'company' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
          onClick={() => {
            setFolioFocus('company');
            onFolioTab('company');
          }}
        >
          {t('folioTab.company')}
        </button>
        {deletedRows.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={folioFocus === 'deleted'}
            className={folioFocus === 'deleted' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            onClick={() => setFolioFocus('deleted')}
          >
            {t('folioTab.deleted')}
          </button>
        ) : null}
      </div>
      {folioFocus === 'deleted' ? (
        <p className="m-0 text-[12px]">
          <Link className="text-[#1F6FEB] underline" href="/reports/payment-voids">
            {t('folioTab.deleted')}
          </Link>
        </p>
      ) : null}

      {visibleRows.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-[#D5DADF] bg-[#F8FAFC] px-4 py-6 text-center"
          data-testid="folio-empty-state"
        >
          <p className={`m-0 text-[13px] ${TEXT_MUTED_CLASS}`}>{t('folioEmptyHint')}</p>
          <div className="mt-3 flex justify-center">{folioFocus === 'deleted' ? null : cashBar}</div>
        </div>
      ) : (
        <>
          {renderGrid(visibleRows)}
          {cashBar}
        </>
      )}

      {closable.length > 0 && can(PERMISSIONS.FOLIO_PAYMENT) ? (
        <div className="flex flex-wrap gap-2">
          {closable.map((f) => (
            <button key={f.id} type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCloseId(f.id)}>
              {tf('closeFolio')} · {personalSections.find((section) => section.folio.id === f.id)?.label ?? f.type}
            </button>
          ))}
        </div>
      ) : null}

      <FinanceBoundaryBanner target="salesInvoices" />
      {modals}
    </div>
  );
}
