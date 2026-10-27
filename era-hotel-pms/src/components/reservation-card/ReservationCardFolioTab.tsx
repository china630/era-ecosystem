'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { bakuDateDisplay, bakuDateTimeDisplay, bakuTimeLabel } from '@era/satellite-kit/time';
import { Printer } from 'lucide-react';
import {
  CatalogField,
  DANGER_BUTTON_CLASS,
  EraMenu,
  EraMenuItem,
  Field,
  FilterChips,
  FxEquivalentBadge,
  GHOST_BUTTON_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import { stayMoneyPair } from '@/lib/folio-money-pair';
import {
  formatLedgerAmount,
  ledgerAmountClass,
  ledgerMoneyKind,
  ledgerRowClass,
} from '@/lib/folio-ledger-display';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { FolioChargeModal } from '@/components/folio/FolioChargeModal';
import {
  FolioDeletePaymentModal,
  FolioRefundModal,
  FolioTransferModal,
  FolioVoidModal,
} from '@/components/folio/FolioLineModals';
import { FolioPaymentModal } from '@/components/folio/FolioPaymentModal';
import { displayRoomChargeNote } from '@/lib/folio-charge-note';
import { escapePrintHtml, openPrintDocument } from '@/lib/print-window';
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
    createdAt?: string;
    adjustsChargeId?: string | null;
    adjustmentReason?: string | null;
    paxNo?: number | null;
    invoiceRef?: string | null;
    revenueCodeId?: string | null;
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
    businessDate?: string;
    createdAt?: string;
    voidedAt?: string | null;
    voidReason?: string | null;
    refundReason?: string | null;
    refundOfPaymentId?: string | null;
    revenueCodeId?: string | null;
    revenueCode?: { code: string; name?: string | null } | null;
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
  whenDate: string;
  whenTime: string;
  /** Legacy combined stamp for print/search. */
  when: string;
  rowNo?: number;
  adjustsChargeId?: string | null;
  adjustmentReason?: string | null;
  paxNo?: number | null;
  chargeId?: string;
  paymentId?: string;
  paymentKind?: string | null;
  paymentMethod?: string;
  refundable?: boolean;
  refundMax?: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  isCityLedger?: boolean;
};

function stampParts(isoOrDate?: string | null, dateOnly?: string | null): {
  whenDate: string;
  whenTime: string;
  when: string;
} {
  if (isoOrDate) {
    return {
      whenDate: bakuDateDisplay(isoOrDate),
      whenTime: bakuTimeLabel(isoOrDate),
      when: bakuDateTimeDisplay(isoOrDate),
    };
  }
  if (dateOnly) {
    const day = dateOnly.slice(0, 10);
    return { whenDate: day, whenTime: '—', when: day };
  }
  return { whenDate: '—', whenTime: '—', when: '—' };
}

function pocketName(t: (key: string) => string, folioType: string): string {
  if (folioType === 'AGENCY') return t('folioTab.agency');
  if (folioType === 'COMPANY') return t('folioTab.company');
  return t('folioTab.guest');
}

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
  if (items.length === 0) return null;
  return (
    <EraMenu
      trigger={
        <button type="button" className={GHOST_BUTTON_CLASS}>
          {label}
        </button>
      }
    >
      {items.map((item) => (
        <EraMenuItem key={item.id} onSelect={item.run}>
          {item.label}
        </EraMenuItem>
      ))}
    </EraMenu>
  );
}

function partyOf(tab: FolioSubTab): FolioParty {
  if (tab === 'agency') return 'agency';
  if (tab === 'company') return 'company';
  return 'guest';
}

/** On-card folio: the ledger, plus extra charge / extra payment / transfer. */
export function ReservationCardFolioTab({
  reservationId,
  folioTab,
  accounts,
  pax = [],
  displayCurrency = 'AZN',
  canPostCharges = false,
  hasAgency = false,
  hasCompany = false,
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
  hasAgency?: boolean;
  hasCompany?: boolean;
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
  const [voidId, setVoidId] = useState<string | null>(null);
  const [refund, setRefund] = useState<{
    id: string;
    max: number;
    folioStatus: string;
    paymentMethod?: string;
  } | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [transferIds, setTransferIds] = useState<string[]>([]);
  const [paymentTransferIds, setPaymentTransferIds] = useState<string[]>([]);
  const [folioFocus, setFolioFocus] = useState<string>('all');
  const [articleFilter, setArticleFilter] = useState('all');
  const [lineKind, setLineKind] = useState<'all' | 'charge' | 'payment'>('all');
  const [folioQuery, setFolioQuery] = useState('');
  const [adjustCharge, setAdjustCharge] = useState<{ id: string; description: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [slip, setSlip] = useState<LedgerRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        const received = (charge as { serviceReceivedAt?: string | null }).serviceReceivedAt
          ? ` · ${tf('serviceReceived')}`
          : '';
        const isCity =
          raw === 'City ledger agency' || raw === 'City ledger company';
        const cityLine =
          raw === 'City ledger agency'
            ? tf('cityLedgerAgency')
            : raw === 'City ledger company'
              ? tf('cityLedgerCompany')
              : note;
        const stamp = stampParts(charge.createdAt, charge.businessDate);
        const isAdjust = Boolean(charge.adjustsChargeId);
        rows.push({
          id: charge.id,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'charge',
          description: `${isAdjust ? `${tf('adjustBadge')}: ` : ''}${cityLine}${received}`,
          code: revenueLabel(charge.revenueCode, locale),
          amount: Number(charge.amount) * (charge.qty == null ? 1 : Number(charge.qty)),
          ...stamp,
          adjustsChargeId: charge.adjustsChargeId,
          adjustmentReason: charge.adjustmentReason,
          paxNo: charge.paxNo,
          chargeId: charge.id,
          isCityLedger: isCity,
        });
      }
      for (const payment of folio.payments ?? []) {
        if (!payment.id) continue;
        if (payment.voidedAt) continue;
        const refundMax = Math.max(0, Number(payment.amount) - (refunded.get(payment.id) ?? 0));
        const isRefund = payment.kind === 'REFUND';
        const stamp = stampParts(payment.createdAt, payment.businessDate);
        rows.push({
          id: `pay-${payment.id}`,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'payment',
          description: isRefund ? tf('refund') : tf('ledgerPayment'),
          code: payment.revenueCode
            ? revenueLabel(payment.revenueCode, locale)
            : tPay(payment.paymentMethod as 'CASH'),
          amount: Number(payment.amount),
          ...stamp,
          paymentId: payment.id,
          paymentKind: payment.kind,
          paymentMethod: payment.paymentMethod,
          refundable: !isRefund && refundMax > 0.01,
          refundMax,
        });
      }
    }
    return rows;
  }, [accounts, locale, tPay, tf]);

  const deletedRows = useMemo(() => {
    const rows: LedgerRow[] = [];
    for (const folio of accounts) {
      for (const payment of folio.payments ?? []) {
        if (!payment.id || !payment.voidedAt) continue;
        const stamp = stampParts(payment.createdAt, payment.businessDate);
        rows.push({
          id: `void-${payment.id}`,
          folioId: folio.id,
          folioType: folio.type,
          folioStatus: folio.status,
          kind: 'payment',
          description: payment.voidReason?.trim() || tf('deletePayment'),
          code: payment.paymentMethod,
          amount: Number(payment.amount),
          ...stamp,
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

  const articleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of visibleRows) {
      if (row.kind !== 'charge') continue;
      if (row.code && row.code !== '—') seen.set(row.code, row.code);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [visibleRows]);

  const filteredRows = useMemo(() => {
    const needle = folioQuery.trim().toLowerCase();
    return visibleRows.filter((row) => {
      if (articleFilter !== 'all' && row.code !== articleFilter) return false;
      if (lineKind !== 'all' && row.kind !== lineKind) return false;
      if (!needle) return true;
      return `${row.description} ${row.code}`.toLowerCase().includes(needle);
    });
  }, [articleFilter, folioQuery, lineKind, visibleRows]);

  const lineCount = (rows: LedgerRow[]) => rows.length;
  const guestLineCount = (guestId: string) =>
    lineCount(
      ledger.filter((row) => {
        const folio = accounts.find((item) => item.id === row.folioId);
        return folio?.type === 'GUEST' && folio.reservationGuestId === guestId;
      }),
    );
  const agencyLines = lineCount(ledger.filter((row) => row.folioType === 'AGENCY'));
  const companyLines = lineCount(ledger.filter((row) => row.folioType === 'COMPANY'));

  useEffect(() => {
    if (folioFocus === 'all' || folioFocus === 'deleted') return;
    if (folioFocus === 'agency' && agencyLines === 0) setFolioFocus('all');
    if (folioFocus === 'company' && companyLines === 0) setFolioFocus('all');
    if (folioFocus.startsWith('guest:') && guestLineCount(folioFocus.slice('guest:'.length)) === 0) {
      setFolioFocus('all');
    }
  }, [agencyLines, companyLines, folioFocus, ledger, accounts]);

  useEffect(() => {
    if (articleFilter === 'all') return;
    if (!articleOptions.some((option) => option.value === articleFilter)) setArticleFilter('all');
  }, [articleFilter, articleOptions]);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  function toggleRow(id: string, on: boolean) {
    setSelectedIds((prev) => (on ? Array.from(new Set([...prev, id])) : prev.filter((row) => row !== id)));
  }

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
      {
        key: 'rowNo',
        header: t('folioRowNo'),
        className: 'w-10 text-right font-mono',
        render: (row) => String(row.rowNo ?? ''),
      },
      {
        key: 'pick',
        header: (
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={allFilteredSelected}
            onChange={(e) => {
              const on = e.target.checked;
              setSelectedIds((prev) => {
                const ids = new Set(prev);
                for (const row of filteredRows) {
                  if (on) ids.add(row.id);
                  else ids.delete(row.id);
                }
                return Array.from(ids);
              });
            }}
            aria-label={t('folioSelectAll')}
          />
        ) as unknown as string,
        render: (row) => (
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={selectedIds.includes(row.id)}
            onChange={(e) => toggleRow(row.id, e.target.checked)}
            aria-label={row.description}
          />
        ),
      },
      { key: 'folioType', header: tf('pocket'), render: (row) => pocketName(t, row.folioType) },
      { key: 'code', header: tf('xercMaddesi'), render: (row) => row.code },
      {
        key: 'description',
        header: t('folioDesc'),
        render: (row) => {
          const moneyKind = ledgerMoneyKind(row);
          const badge =
            moneyKind === 'refund'
              ? tf('refundBadge')
              : moneyKind === 'adjust'
                ? tf('adjustBadge')
                : row.isCityLedger
                  ? tf('cityLedgerBadge')
                  : moneyKind === 'payment'
                    ? tf('paymentBadge')
                    : null;
          return (
            <span>
              {badge ? (
                <span className="mr-1 inline-block rounded bg-white/80 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#34495E]">
                  {badge}
                </span>
              ) : null}
              {row.description}
            </span>
          );
        },
      },
      {
        key: 'whenDate',
        header: t('folioDate'),
        className: 'whitespace-nowrap font-mono',
        render: (row) => row.whenDate,
      },
      {
        key: 'whenTime',
        header: t('folioTime'),
        className: 'whitespace-nowrap font-mono',
        render: (row) => row.whenTime,
      },
      {
        key: 'amount',
        header: t('amount'),
        className: 'text-right font-mono',
        render: (row) => {
          const moneyKind = ledgerMoneyKind(row);
          return (
            <span className={ledgerAmountClass(moneyKind)}>
              {formatLedgerAmount(row.amount, moneyKind)} {displayCurrency}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: tf('actions'),
        render: (row) => (
          <FolioRowMenu
            label={tf('rowMenu')}
            items={[
              ...(row.kind === 'charge' && can(PERMISSIONS.FOLIO_CHARGE) && row.folioStatus === 'OPEN'
                ? [
                    {
                      id: 'adjust',
                      label: tf('adjust'),
                      run: () => {
                        setAdjustAmount('');
                        setAdjustReason('');
                        setAdjustCharge({ id: row.chargeId ?? '', description: row.description });
                      },
                    },
                  ]
                : []),
              ...(row.kind === 'charge' && row.adjustsChargeId
                ? [{ id: 'slip', label: tf('adjustPrint'), run: () => setSlip(row) }]
                : []),
              ...(row.kind === 'charge' && can(PERMISSIONS.FOLIO_VOID)
                ? [{ id: 'void', label: tf('void'), run: () => setVoidId(row.chargeId ?? null) }]
                : []),
              ...(row.kind === 'charge' && can(PERMISSIONS.FOLIO_CHARGE) && row.folioStatus === 'OPEN'
                ? [{ id: 'transfer', label: tf('transfer'), run: () => setTransferIds(row.chargeId ? [row.chargeId] : []) }]
                : []),
              ...(row.kind === 'payment' && can(PERMISSIONS.FOLIO_VOID) && row.paymentId
                ? [{ id: 'delete', label: tf('deletePayment'), run: () => setDeletePaymentId(row.paymentId ?? null) }]
                : []),
              ...(row.kind === 'payment' && can(PERMISSIONS.FOLIO_PAYMENT) && row.folioStatus === 'OPEN' && row.paymentId
                ? [{ id: 'transferPay', label: tf('transfer'), run: () => setPaymentTransferIds([row.paymentId!]) }]
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
                          paymentMethod: row.paymentMethod,
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
  }, [allFilteredSelected, can, displayCurrency, filteredRows, selectedIds, t, tf]);

  const selectedCharges = filteredRows.filter(
    (row) => row.kind === 'charge' && selectedIds.includes(row.id) && row.chargeId,
  );
  const selectedPayments = filteredRows.filter(
    (row) => row.kind === 'payment' && selectedIds.includes(row.id) && row.paymentId && row.folioStatus === 'OPEN',
  );
  const cashBar = (
    <div className="flex flex-wrap gap-2">
      {canPostCharges && can(PERMISSIONS.FOLIO_CHARGE) ? (
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setChargeOpen(true)}>
          {tf('extraCharge')}
        </button>
      ) : (
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled title={t('postingAfterCheckIn')}>
          {tf('extraCharge')}
        </button>
      )}
      {can(PERMISSIONS.FOLIO_PAYMENT) ? (
        <button type="button" className={DANGER_BUTTON_CLASS} onClick={() => setPayOpen(true)}>
          {tf('extraPayment')}
        </button>
      ) : null}
      {can(PERMISSIONS.FOLIO_CHARGE) ? (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={selectedCharges.length === 0 && selectedPayments.length === 0}
          onClick={() => {
            setTransferIds(selectedCharges.map((row) => row.chargeId!).filter(Boolean));
            setPaymentTransferIds(selectedPayments.map((row) => row.paymentId!).filter(Boolean));
          }}
        >
          {tf('transferSelected')}
        </button>
      ) : null}
    </div>
  );

  function renderGrid(rows: LedgerRow[]) {
    if (rows.length === 0) {
      return <p className={`m-0 py-2 text-center text-[12px] ${TEXT_MUTED_CLASS}`}>{tc('empty')}</p>;
    }
    const numbered = rows.map((row, index) => ({ ...row, rowNo: index + 1 }));
    return (
      <HotelDataGrid<LedgerRow>
        columns={columns}
        rows={numbered}
        rowKey={(row) => row.id}
        emptyMessage={tc('empty')}
        defaultPageSize={25}
        embedded
        cellClassName="!px-2 !py-1.5 !font-mono !text-[12px]"
        pagination={false}
        paginationMode="server"
        page={1}
        pageSize={Math.max(numbered.length, 1)}
        total={numbered.length}
        rowClassName={(row) => ledgerRowClass(ledgerMoneyKind(row))}
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
        hasCompany={hasCompany || accounts.some((folio) => folio.type === 'COMPANY')}
        hasAgency={hasAgency || accounts.some((folio) => folio.type === 'AGENCY')}
      />
      <FolioChargeModal
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        onDone={onChanged}
        reservationId={reservationId}
        guests={payers}
        pocketOptions={[
          { value: 'GUEST' as const, label: t('folioTab.guest') },
          ...(hasAgency || agencyLines > 0 || accounts.some((f) => f.type === 'AGENCY')
            ? [{ value: 'AGENCY' as const, label: t('folioTab.agency') }]
            : []),
          ...(hasCompany || companyLines > 0 || accounts.some((f) => f.type === 'COMPANY')
            ? [{ value: 'COMPANY' as const, label: t('folioTab.company') }]
            : []),
        ]}
      />
      <FolioVoidModal open={Boolean(voidId)} chargeId={voidId} onClose={() => setVoidId(null)} onDone={onChanged} />
      <FolioRefundModal open={Boolean(refund)} payment={refund} onClose={() => setRefund(null)} onDone={onChanged} />
      <FolioDeletePaymentModal
        open={Boolean(deletePaymentId)}
        paymentId={deletePaymentId}
        onClose={() => setDeletePaymentId(null)}
        onDone={onChanged}
      />
      <FolioTransferModal
        open={transferIds.length > 0 || paymentTransferIds.length > 0}
        chargeId={transferIds[0] ?? null}
        chargeIds={transferIds}
        paymentIds={paymentTransferIds}
        reservationId={reservationId}
        guests={payers}
        hasCompany={hasCompany || accounts.some((folio) => folio.type === 'COMPANY')}
        hasAgency={hasAgency || accounts.some((folio) => folio.type === 'AGENCY')}
        onClose={() => {
          setTransferIds([]);
          setPaymentTransferIds([]);
        }}
        onDone={onChanged}
      />
    </>
  );

  const chargeTotal = filteredRows
    .filter((row) => row.kind === 'charge')
    .reduce((sum, row) => sum + row.amount, 0);
  const paymentTotal = filteredRows
    .filter((row) => row.kind === 'payment')
    .reduce((sum, row) => sum + (row.paymentKind === 'REFUND' ? -row.amount : row.amount), 0);
  const focusFolios =
    folioFocus === 'agency'
      ? accounts.filter((folio) => folio.type === 'AGENCY')
      : folioFocus === 'company'
        ? accounts.filter((folio) => folio.type === 'COMPANY')
        : focusGuestId
          ? accounts.filter((folio) => folio.type === 'GUEST' && folio.reservationGuestId === focusGuestId)
          : accounts;
  const moneyPair = stayMoneyPair(
    focusFolios.flatMap((folio) =>
      folio.charges.filter(
        (charge) => articleFilter === 'all' || revenueLabel(charge.revenueCode, locale) === articleFilter,
      ),
    ),
    focusFolios.flatMap((folio) =>
      (folio.payments ?? []).filter(
        (payment) =>
          articleFilter === 'all' ||
          (payment.revenueCode != null && revenueLabel(payment.revenueCode, locale) === articleFilter),
      ),
    ),
  );

  const guestFocusDebt = stayMoneyPair(
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'GUEST')
      .flatMap((folio) => folio.charges),
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'GUEST')
      .flatMap((folio) => folio.payments ?? []),
  ).debt;
  const companyFocusDebt = stayMoneyPair(
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'COMPANY')
      .flatMap((folio) => folio.charges),
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'COMPANY')
      .flatMap((folio) => folio.payments ?? []),
  ).debt;
  const agencyFocusDebt = stayMoneyPair(
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'AGENCY')
      .flatMap((folio) => folio.charges),
    accounts
      .filter((folio) => folio.status === 'OPEN' && folio.type === 'AGENCY')
      .flatMap((folio) => folio.payments ?? []),
  ).debt;

  const debtSummaryLines = (() => {
    if (folioFocus === 'agency') {
      return [
        `${t('agencyOwes')}: ${moneyPair.debt.toFixed(2)} ${displayCurrency}`,
        `${t('overpaid')}: ${moneyPair.unused.toFixed(2)} ${displayCurrency}`,
      ];
    }
    if (folioFocus === 'company') {
      return [
        `${t('companyOwes')}: ${moneyPair.debt.toFixed(2)} ${displayCurrency}`,
        `${t('overpaid')}: ${moneyPair.unused.toFixed(2)} ${displayCurrency}`,
      ];
    }
    if (focusGuestId || folioFocus.startsWith('guest:')) {
      return [
        `${t('guestOwes')}: ${moneyPair.debt.toFixed(2)} ${displayCurrency}`,
        `${t('overpaid')}: ${moneyPair.unused.toFixed(2)} ${displayCurrency}`,
      ];
    }
    const lines: string[] = [];
    if (guestFocusDebt > 0.01) lines.push(`${t('guestOwes')}: ${guestFocusDebt.toFixed(2)} ${displayCurrency}`);
    if (companyFocusDebt > 0.01) {
      lines.push(`${t('companyOwes')}: ${companyFocusDebt.toFixed(2)} ${displayCurrency}`);
    }
    if (agencyFocusDebt > 0.01) {
      lines.push(`${t('agencyOwes')}: ${agencyFocusDebt.toFixed(2)} ${displayCurrency}`);
    }
    if (lines.length === 0) lines.push(`${t('guestOwes')}: 0.00 ${displayCurrency}`);
    lines.push(`${t('overpaid')}: ${moneyPair.unused.toFixed(2)} ${displayCurrency}`);
    return lines;
  })();

  function printRows() {
    const body = filteredRows
      .map((row, index) => {
        const moneyKind = ledgerMoneyKind(row);
        return `<tr><td>${index + 1}</td><td>${escapePrintHtml(row.whenDate)}</td><td>${escapePrintHtml(row.whenTime)}</td><td>${escapePrintHtml(pocketName(t, row.folioType))}</td><td>${escapePrintHtml(row.code)}</td><td>${escapePrintHtml(row.description)}</td><td style="text-align:right">${escapePrintHtml(formatLedgerAmount(row.amount, moneyKind))}</td></tr>`;
      })
      .join('');
    const debtWords = debtSummaryLines.join(' · ');
    const guest = namedPax[0]?.label ?? '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapePrintHtml(t('folioPrint'))}</title>
<style>body{font-family:"Segoe UI",sans-serif;margin:24px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f4f5f7}</style>
</head><body><h1 style="font-size:16px">${escapePrintHtml(guest)} · ${escapePrintHtml(t('folioPrint'))}</h1><p>${escapePrintHtml(tf('xercMaddesi'))}: ${escapePrintHtml(articleFilter)} · ${escapePrintHtml(lineKind)}</p><table><thead><tr><th>#</th><th>${escapePrintHtml(t('folioDate'))}</th><th>${escapePrintHtml(t('folioTime'))}</th><th>${escapePrintHtml(tf('pocket'))}</th><th>${escapePrintHtml(tf('xercMaddesi'))}</th><th>${escapePrintHtml(t('folioDesc'))}</th><th>${escapePrintHtml(t('amount'))}</th></tr></thead><tbody>${body}</tbody></table><p>${escapePrintHtml(t('folioTotalCharges'))}: ${chargeTotal.toFixed(2)} ${displayCurrency}<br>${escapePrintHtml(t('folioTotalPayments'))}: ${paymentTotal.toFixed(2)} ${displayCurrency}<br><strong>${escapePrintHtml(debtWords)}</strong></p></body></html>`;
    if (!openPrintDocument(html)) showApiError({ error: t('printBlocked') }, t('printBlocked'));
  }

  async function submitAdjustment() {
    if (!adjustCharge) return;
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount === 0 || !adjustReason.trim()) return;
    setAdjustBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${adjustCharge.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: adjustReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('updateFailed'));
        return;
      }
      showSuccess(tf('adjustSaved'));
      setAdjustCharge(null);
      onChanged?.();
    } catch (error) {
      showApiError({ error: error instanceof Error ? error.message : tc('updateError') });
    } finally {
      setAdjustBusy(false);
    }
  }

  const pocketItems = [
    { id: 'all', label: t('folioTab.all'), hidden: false },
    ...namedPax.map((guest) => {
      const id = guest.row.id ?? '';
      return {
        id: `guest:${id}`,
        label: guest.label,
        hidden: !id || guestLineCount(id) === 0,
      };
    }),
    { id: 'agency', label: t('folioTab.agency'), hidden: agencyLines === 0 },
    { id: 'company', label: t('folioTab.company'), hidden: companyLines === 0 },
    { id: 'deleted', label: t('folioTab.deleted'), hidden: deletedRows.length === 0 },
  ];
  const livePockets = pocketItems.filter((item) => item.id !== 'all' && item.id !== 'deleted' && !item.hidden);
  const hideAllChip = livePockets.length < 2;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="reservation-folio-tab">
      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1">
        <FilterChips
          ariaLabel={t('folioTab.all')}
          value={folioFocus}
          alwaysVisibleIds={hideAllChip ? [] : ['all']}
          onChange={(id) => {
            setFolioFocus(id);
            if (id === 'agency') onFolioTab('agency');
            else if (id === 'company') onFolioTab('company');
            else if (id.startsWith('guest:')) onFolioTab('guest');
            else onFolioTab('all');
          }}
          items={pocketItems.map((item) =>
            item.id === 'all' ? { ...item, hidden: hideAllChip } : item,
          )}
        />
        </div>
        <button
          type="button"
          className={`${GHOST_BUTTON_CLASS} ml-auto h-8 w-8 shrink-0 !px-0`}
          aria-label={t('folioPrint')}
          onClick={printRows}
        >
          <Printer className="h-4 w-4" />
        </button>
      </div>
      <div className="flex w-full shrink-0 flex-nowrap items-end gap-2">
        <CatalogField
          kind="CLOSED_SMALL"
          label={tf('xercMaddesi')}
          value={articleFilter}
          onChange={(v) => setArticleFilter(String(v ?? 'all'))}
          options={[
            { value: 'all', label: t('folioTab.all') },
            ...articleOptions.map((option) => ({ value: option.value, label: option.label })),
          ]}
          emptyLabel={null}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tf('lineKind')}
          value={lineKind}
          onChange={(v) => setLineKind((String(v ?? 'all') as 'all' | 'charge' | 'payment'))}
          options={[
            { value: 'all', label: t('folioTab.all') },
            { value: 'charge', label: t('folioLinesCharges') },
            { value: 'payment', label: t('folioLinesPayments') },
          ]}
          emptyLabel={null}
        />
        <input
          type="search"
          className={`${MODAL_INPUT_CLASS} min-w-0 flex-1`}
          value={folioQuery}
          onChange={(event) => setFolioQuery(event.target.value)}
          placeholder={t('folioSearch')}
          aria-label={t('folioSearch')}
        />
      </div>
      {folioFocus === 'deleted' ? (
        <p className="m-0 shrink-0 text-[12px]">
          <Link className="text-[#1F6FEB] underline" href="/reports/payment-voids">
            {t('folioTab.deleted')}
          </Link>
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {filteredRows.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-[#D5DADF] bg-[#F8FAFC] px-4 py-6 text-center"
            data-testid="folio-empty-state"
          >
            <p className={`m-0 text-[13px] ${TEXT_MUTED_CLASS}`}>{t('folioEmptyHint')}</p>
          </div>
        ) : (
          renderGrid(filteredRows)
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-[#D5DADF] pt-2">
        <table className="w-full font-mono text-[12px]" data-testid="folio-filtered-total">
          <tbody>
            <tr>
              <td className="px-2 py-1 text-right text-[14px] font-medium text-[#95A5A6]">
                {t('folioTotalCharges')}: {chargeTotal.toFixed(2)} {displayCurrency}
              </td>
              <td className="px-2 py-1 text-right text-[14px] font-medium text-[#95A5A6]">
                {t('folioTotalPayments')}: {paymentTotal.toFixed(2)} {displayCurrency}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right text-[14px] font-semibold text-[#34495E]">
                {debtSummaryLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2">
          {folioFocus === 'deleted' ? null : cashBar}
        </div>
      </div>
      <FinanceBoundaryBanner target="salesInvoices" />
      {modals}
      <EraModal
        open={Boolean(adjustCharge)}
        title={tf('adjust')}
        onClose={() => setAdjustCharge(null)}
        footer={
          <EraModalFooter
            onCancel={() => setAdjustCharge(null)}
            onSubmit={() => void submitAdjustment()}
            busy={adjustBusy}
            submitDisabled={!adjustReason.trim() || !Number(adjustAmount)}
            submitLabel={tf('adjust')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          <p className="m-0 text-[#34495E]">{adjustCharge?.description}</p>
          <Field
            label={t('amount')}
            preset="amount"
            type="number"
            step="0.01"
            value={adjustAmount}
            onChange={(event) => setAdjustAmount(event.target.value)}
          />
          <Field
            label={tf('adjustReason')}
            preset="longText"
            value={adjustReason}
            onChange={(event) => setAdjustReason(event.target.value)}
          />
        </div>
      </EraModal>
      <EraModal
        open={Boolean(slip)}
        title={tf('adjustPrint')}
        onClose={() => setSlip(null)}
        footer={
          <EraModalFooter
            onCancel={() => setSlip(null)}
            onSubmit={() => {
              if (!slip) return;
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapePrintHtml(tf('adjustPrint'))}</title></head><body style="font-family:ui-monospace,monospace;font-size:12px"><h1 style="font-size:16px">${escapePrintHtml(tf('adjustSlip'))}</h1><p>${escapePrintHtml(slip.when)}</p><p>${escapePrintHtml(slip.description)}</p><p>${escapePrintHtml(slip.adjustmentReason ?? '')}</p><p><strong>${slip.amount.toFixed(2)} ${displayCurrency}</strong></p></body></html>`;
              if (!openPrintDocument(html)) showApiError({ error: t('printBlocked') }, t('printBlocked'));
            }}
            submitLabel={t('folioPrint')}
          />
        }
      >
        <div className="space-y-1 font-mono text-[12px] text-[#34495E]">
          <p className="m-0">{slip?.when}</p>
          <p className="m-0">{slip?.description}</p>
          <p className="m-0">{slip?.adjustmentReason}</p>
          <p className="m-0 text-[18px] font-semibold">
            {slip ? `${slip.amount.toFixed(2)} ${displayCurrency}` : ''}
          </p>
        </div>
      </EraModal>
    </div>
  );
}
