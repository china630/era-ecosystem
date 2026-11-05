'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
  Field,
  FieldSection,
  FieldTextarea,
  FORM_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  parseApiError,
  showApiError,
  showSuccess,
  showWarning,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { pocketNetMoney } from '@/lib/folio-money-pair';
import { PAYMENT_CATEGORIES, resolvePaymentCategory } from '@/lib/payment-category';
import { earlyReversalByFolio } from '@/lib/early-checkout-reversal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

const FALLBACK_GUEST_TENDERS = ['CASH', 'CARD', 'EPOINT', 'BANK_TRANSFER', 'LOYALTY_POINTS'] as const;
const FALLBACK_PAYER_TENDERS = ['CASH', 'CARD', 'EPOINT', 'BANK_TRANSFER'] as const;

type FolioRow = {
  id: string;
  type: string;
  status: string;
  reservationGuest?: {
    firstName?: string | null;
    lastName?: string | null;
    guest?: { fullName?: string | null } | null;
  } | null;
  reservation?: {
    guest?: { fullName?: string | null } | null;
    room?: { roomNumber?: string | null } | null;
    agency?: { id?: string | null; name?: string | null } | null;
    company?: { id?: string | null; name?: string | null } | null;
    agencyId?: string | null;
    companyId?: string | null;
  } | null;
  charges: Array<{
    id?: string;
    externalRef?: string | null;
    description?: string | null;
    amount: number | string;
    qty?: number | null;
    businessDate?: string;
    revenueCode?: {
      paymentCategory?: string | null;
      systemRole?: string | null;
      code?: string | null;
      name?: string | null;
      nameAz?: string | null;
      nameRu?: string | null;
      nameEn?: string | null;
    } | null;
    paymentAllocations?: Array<{ amount: number | string }>;
  }>;
  payments?: Array<{
    amount: number | string;
    kind?: string | null;
    paymentCategory?: string | null;
    voidedAt?: string | null;
  }>;
};

type ClinicProcedure = {
  orderId: string;
  procedureName: string;
  amount: number;
  scheduledAt: string;
  status: 'in_plan' | 'arrived' | 'no_show' | 'completed' | 'cancelled';
  folioRef: string | null;
  inPackage: boolean;
  checkedInAt?: string | null;
};

type ClinicCheckout = {
  medical: boolean;
  unavailable?: boolean;
  paid?: ClinicProcedure[];
  unpaidExtras?: ClinicProcedure[];
  executed?: ClinicProcedure[];
  packageSessions?: ClinicProcedure[];
  futurePaid?: ClinicProcedure[];
  pastNoShowish?: ClinicProcedure[];
  futureUnpaid?: ClinicProcedure[];
  futurePackage?: ClinicProcedure[];
  noShowKeepsCharge?: boolean;
  blocksCheckout?: boolean;
};

type EarlyPreview = {
  applicable: boolean;
  unusedNights: number;
  unusedSellGross: number;
  vatWithheld: number;
  guestCashRefund: number;
  reversalByFolio: Record<string, number>;
};

type Choice = '' | 'PAY' | 'DEBT' | 'CL' | 'MOVE_PAYER_CL';

type TenderLine = { method: string; amount: string; bankReference: string; bankTerminalId: string };

type DebtBlock = {
  folio: FolioRow;
  party: 'GUEST' | 'AGENCY' | 'COMPANY';
  title: string;
  debt: number;
  /** Hotel owes this folio. Settled in the same block, not a second form. */
  credit: number;
  /** Early checkout voids lodging on this payer folio; settle would see the pre-void balance. */
  pendingReversal: boolean;
};

function emptyLine(amount = ''): TenderLine {
  return { method: '', amount, bankReference: '', bankTerminalId: '' };
}

function money(n: number): string {
  return n.toFixed(2);
}

function categorySplit(folio: FolioRow) {
  const services: Record<string, number> = { LODGING: 0, CLINIC: 0, FB: 0, OTHER: 0 };
  const paid: Record<string, number> = { LODGING: 0, CLINIC: 0, FB: 0, OTHER: 0 };
  for (const charge of folio.charges) {
    const cat = resolvePaymentCategory(charge) ?? 'OTHER';
    const qty = charge.qty == null ? 1 : Number(charge.qty);
    services[cat] += Number(charge.amount) * (Number.isFinite(qty) ? qty : 1);
  }
  for (const payment of folio.payments ?? []) {
    if (payment.voidedAt) continue;
    const cat = resolvePaymentCategory(payment) ?? 'OTHER';
    const sign = payment.kind === 'REFUND' ? -1 : 1;
    paid[cat] += sign * Number(payment.amount);
  }
  return { services, paid };
}

/**
 * The one check-out dialog (folio tab, room rack, card stay action).
 * Each debtor folio gets its own block. Nothing is preselected; submit waits for a choice per block.
 */
export function FolioCheckoutModal({
  open,
  onClose,
  onDone,
  reservationId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reservationId: string;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const tHk = useTranslations('housekeeping');
  const { can } = useAuth();
  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [lines, setLines] = useState<Record<string, TenderLine[]>>({});
  const [guestDebtNote, setGuestDebtNote] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [early, setEarly] = useState<EarlyPreview | null>(null);
  const [refundMethod, setRefundMethod] = useState('');
  const [refundTerminal, setRefundTerminal] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [error, setError] = useState('');
  const [checkoutChip, setCheckoutChip] = useState<'money' | 'open' | 'fact'>('money');
  const [busy, setBusy] = useState(false);
  const [clinic, setClinic] = useState<ClinicCheckout | null>(null);
  const [laundry, setLaundry] = useState<
    Array<{ id: string; guestName: string; roomNumber?: string | null; dueAt?: string | null }>
  >([]);
  const [laundryTicketId, setLaundryTicketId] = useState('');
  const [laundryScan, setLaundryScan] = useState('');
  const [laundryBusy, setLaundryBusy] = useState(false);
  const [guestTenders, setGuestTenders] = useState<string[]>([...FALLBACK_GUEST_TENDERS]);
  const [payerTenders, setPayerTenders] = useState<string[]>([...FALLBACK_PAYER_TENDERS]);

  const loadFolios = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/folios?reservationId=${encodeURIComponent(reservationId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(parseApiError(data, tc('loadError')));
      const rows = (Array.isArray(data) ? data : (data.data ?? [])) as FolioRow[];
      setFolios(rows);
      return rows;
    } catch {
      setLoadFailed(true);
      setFolios([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [reservationId, tc]);

  useEffect(() => {
    if (!open || !reservationId) return;
    setChoices({});
    setLines({});
    setGuestDebtNote('');
    setDiscountAmount('');
    setEarly(null);
    setRefundMethod('');
    setRefundTerminal('');
    setRefundReason('');
    setError('');
    setClinic(null);
    void fetch(`/api/reservations/${reservationId}/clinic-checkout`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const payload = (body?.data ?? body) as ClinicCheckout | null;
        setClinic(payload);
      })
      .catch(() => setClinic(null));
    void loadFolios();
    void fetch('/api/payment-methods?guest=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const rows = (body?.data?.methods ?? body?.methods) as Array<{ code: string }> | undefined;
        if (Array.isArray(rows) && rows.length > 0) {
          const codes = rows.map((row) => row.code);
          setGuestTenders(codes);
          setPayerTenders(codes.filter((c) => c !== 'LOYALTY_POINTS'));
        }
      })
      .catch(() => undefined);
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        setBankTerminals(body?.devices ?? []);
      })
      .catch(() => setBankTerminals([]));
    void fetch(`/api/reservations/${reservationId}/early-checkout-preview`)
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data ?? data;
        if (!payload) return;
        setEarly({
          applicable: !!payload.applicable,
          unusedNights: Number(payload.unusedNights) || 0,
          unusedSellGross: Number(payload.unusedSellGross) || 0,
          vatWithheld: Number(payload.vatWithheld) || 0,
          guestCashRefund: Number(payload.guestCashRefund) || 0,
          reversalByFolio: payload.applicable
            ? earlyReversalByFolio(Array.isArray(payload.chargePlans) ? payload.chargePlans : [])
            : {},
        });
      })
      .catch(() => null);
  }, [open, reservationId, loadFolios]);

  const stayGuest = folios[0]?.reservation?.guest?.fullName?.trim() ?? '';
  const stayRoom = folios[0]?.reservation?.room?.roomNumber?.trim() ?? '';

  const blocks = useMemo<DebtBlock[]>(() => {
    const out: DebtBlock[] = [];
    for (const folio of folios) {
      if (folio.status !== 'OPEN') continue;
      const isPayer = folio.type === 'AGENCY' || folio.type === 'COMPANY';
      // Guest unused nights come back as a refund after check-out; payer unused nights only shrink AR.
      const reversed = isPayer && early?.applicable ? (early.reversalByFolio[folio.id] ?? 0) : 0;
      const net = pocketNetMoney(folio.charges, folio.payments ?? []);
      const debt = Math.round((net.debt - reversed) * 100) / 100;
      const credit = debt > 0.01 ? 0 : Math.round(net.unused * 100) / 100;
      if (debt <= 0.01 && credit <= 0.01) continue;
      if (folio.type === 'GUEST') {
        const rg = folio.reservationGuest;
        const own =
          rg?.guest?.fullName?.trim() || [rg?.firstName, rg?.lastName].filter(Boolean).join(' ').trim();
        out.push({
          folio,
          party: 'GUEST',
          title: t('checkoutGuestBlock', { name: own || stayGuest || '—' }),
          debt,
          credit,
          pendingReversal: false,
        });
      } else if (folio.type === 'AGENCY' || folio.type === 'COMPANY') {
        const name =
          (folio.type === 'AGENCY'
            ? folio.reservation?.agency?.name
            : folio.reservation?.company?.name
          )?.trim() || '—';
        out.push({
          folio,
          party: folio.type,
          title:
            folio.type === 'AGENCY'
              ? t('checkoutAgencyBlock', { name })
              : t('checkoutCompanyBlock', { name }),
          debt,
          credit,
          pendingReversal: reversed > 0.01,
        });
      }
    }
    return out.sort((a, b) => (a.party === 'GUEST' ? 0 : 1) - (b.party === 'GUEST' ? 0 : 1));
  }, [folios, early, stayGuest, t]);

  const firstGuestBlockId = blocks.find((b) => b.party === 'GUEST')?.folio.id;
  const stayMeta = folios[0]?.reservation;
  const hasPayerOnStay = Boolean(
    stayMeta?.companyId ||
      stayMeta?.company?.id ||
      stayMeta?.agencyId ||
      stayMeta?.agency?.id ||
      stayMeta?.company?.name ||
      stayMeta?.agency?.name ||
      folios.some((f) => f.type === 'AGENCY' || f.type === 'COMPANY'),
  );
  const suggestedPayerKind: 'COMPANY' | 'AGENCY' | null =
    stayMeta?.companyId || stayMeta?.company?.id || stayMeta?.company?.name
      ? 'COMPANY'
      : stayMeta?.agencyId || stayMeta?.agency?.id || stayMeta?.agency?.name
        ? 'AGENCY'
        : folios.some((f) => f.type === 'COMPANY')
          ? 'COMPANY'
          : folios.some((f) => f.type === 'AGENCY')
            ? 'AGENCY'
            : null;
  const suggestedPayerName = (() => {
    if (suggestedPayerKind === 'COMPANY') {
      return stayMeta?.company?.name?.trim() || '—';
    }
    if (suggestedPayerKind === 'AGENCY') {
      return stayMeta?.agency?.name?.trim() || '—';
    }
    return '—';
  })();
  const anyMovePayerCl = blocks.some((b) => choices[b.folio.id] === 'MOVE_PAYER_CL');
  const anyGuestDebt = blocks.some((b) => choices[b.folio.id] === 'DEBT');
  const allChosen = blocks.every((b) => {
    if (b.credit > 0.01) return Boolean(lines[b.folio.id]?.[0]?.method);
    if (anyMovePayerCl && (b.party === 'AGENCY' || b.party === 'COMPANY')) return true;
    return Boolean(choices[b.folio.id]);
  });
  const unusedPayment = useMemo(() => {
    // At check-out categories in a pocket already net; leftover is true overpay only.
    // Ignore pocket credits while another open pocket still owes.
    const open = folios.filter((folio) => folio.status === 'OPEN');
    const nets = open.map((folio) => pocketNetMoney(folio.charges, folio.payments ?? []));
    const debt = nets.reduce((sum, row) => sum + row.debt, 0);
    if (debt > 0.01) return 0;
    return nets.reduce((sum, row) => sum + row.unused, 0);
  }, [folios]);
  const refundNeeded = Boolean(early?.applicable && early.guestCashRefund > 0);
  const blocksCheckout = Boolean(clinic?.medical && clinic.unavailable);

  const terminalOptions = bankTerminals.map((row) => ({ value: row.id, label: row.label }));

  function tenderDue(block: DebtBlock): number {
    if (block.folio.id !== firstGuestBlockId) return block.debt;
    const discount = discountAmount ? Number(discountAmount) || 0 : 0;
    return Math.max(0, Math.round((block.debt - discount) * 100) / 100);
  }

  function linesOf(block: DebtBlock): TenderLine[] {
    return lines[block.folio.id] ?? [emptyLine(money(tenderDue(block)))];
  }

  function setLine(block: DebtBlock, idx: number, patch: Partial<TenderLine>) {
    const next = [...linesOf(block)];
    next[idx] = { ...next[idx]!, ...patch };
    setLines((prev) => ({ ...prev, [block.folio.id]: next }));
  }

  function validate(): string | null {
    if (!allChosen) return t('checkoutPickChoice');
    for (const block of blocks) {
      const choice = choices[block.folio.id];
      if (choice !== 'PAY') continue;
      if (!canPay || block.pendingReversal) return t('checkoutPickChoice');
      const rows = linesOf(block).filter((l) => Number(l.amount) > 0);
      if (rows.some((l) => !l.method)) return t('checkoutPickMethod');
      if (rows.some((l) => l.method === 'CARD' && !l.bankTerminalId)) return t('checkoutPickTerminal');
      const paid = rows.reduce((s, l) => s + Number(l.amount), 0);
      const due = tenderDue(block);
      if (paid + 0.01 < due) {
        return t('checkoutTenderShort', { name: block.title, paid: money(paid), due: money(due) });
      }
      if (paid > due + 0.01) {
        return t('checkoutTenderOver', { name: block.title, paid: money(paid), due: money(due) });
      }
    }
    if (anyGuestDebt && !guestDebtNote.trim()) return t('checkoutDebtReasonRequired');
    if (refundNeeded) {
      if (!refundMethod) return t('checkoutPickRefundMethod');
      if (refundMethod === 'CARD' && !refundTerminal) return t('checkoutPickTerminal');
    }
    for (const block of blocks) {
      if (block.credit <= 0.01) continue;
      const line = lines[block.folio.id]?.[0];
      if (!line?.method) return t('checkoutPickRefundMethod');
      if (line.method === 'CARD' && !line.bankTerminalId) return t('checkoutPickTerminal');
    }
    return null;
  }

  async function settleBlock(block: DebtBlock): Promise<string | null> {
    const isFirstGuest = block.folio.id === firstGuestBlockId;
    const tender = linesOf(block)
      .map((l) => ({
        method: l.method,
        amount: Number(l.amount),
        bankReference: l.method === 'BANK_TRANSFER' && l.bankReference.trim() ? l.bankReference.trim() : undefined,
        bankTerminalId: l.method === 'CARD' ? l.bankTerminalId || undefined : undefined,
      }))
      .filter((l) => l.amount > 0 && l.method);
    if (tender.length === 0) return null;
    const res = await fetch('/api/folios/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folioId: block.folio.id,
        lines: tender,
        applyDeposits: false,
        discountAmount: isFirstGuest && discountAmount ? Number(discountAmount) : undefined,
      }),
    });
    if (res.ok) return null;
    showApiError(await res.json().catch(() => null), tc('error'));
    return 'failed';
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    for (const block of blocks) {
      if (choices[block.folio.id] !== 'PAY') continue;
      const failed = await settleBlock(block);
      if (failed) {
        await loadFolios();
        return;
      }
    }
    const moveGuestDebtToPayer = anyMovePayerCl;
    const transferToCityLedger =
      moveGuestDebtToPayer || blocks.some((b) => choices[b.folio.id] === 'CL');
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferToCityLedger,
          moveGuestDebtToPayer: moveGuestDebtToPayer || undefined,
          transferToGuestDebt: anyGuestDebt,
          guestDebtNote: anyGuestDebt ? guestDebtNote.trim() : undefined,
          unusedNightsRefundMethod: refundNeeded ? refundMethod : undefined,
          unusedNightsBankTerminalId:
            refundNeeded && refundMethod === 'CARD' ? refundTerminal : undefined,
          unusedNightsReason: early?.applicable && refundReason.trim() ? refundReason.trim() : undefined,
          surplusAction: blocks.some((b) => b.credit > 0.01) ? 'REFUND' : undefined,
          surplusMethod: (lines[blocks.find((b) => b.credit > 0.01)?.folio.id ?? '']?.[0]?.method ||
            undefined) as 'CASH' | 'CARD' | undefined,
          surplusBankTerminalId:
            lines[blocks.find((b) => b.credit > 0.01)?.folio.id ?? '']?.[0]?.bankTerminalId ||
            undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const payload = data.data ?? data;
      if (res.ok) {
        onDone?.();
        onClose();
        const warningList = Array.isArray(payload.warnings) ? payload.warnings : [];
        if (warningList.length > 0) {
          showWarning(warningList[0] as string);
        }
        if (payload.cityLedgerTransferred?.length) {
          showSuccess(t('checkoutClSuccess', { count: payload.cityLedgerTransferred.length }));
        } else if (moveGuestDebtToPayer) {
          showSuccess(t('checkoutMovePayerClSuccess'));
        } else {
          showSuccess(t('checkoutSuccess'));
        }
        return;
      }
      if (payload.code === 'LAUNDRY_OPEN' && Array.isArray(payload.tickets)) {
        const tickets = payload.tickets as Array<{
          id: string;
          guestName: string;
          roomNumber?: string | null;
          dueAt?: string | null;
        }>;
        setLaundry(tickets);
        setLaundryTicketId(tickets[0]?.id ?? '');
        setLaundryScan('');
        showApiError({ error: tHk('laundryOpenCheckout'), code: 'LAUNDRY_OPEN' });
        return;
      }
      showApiError(data, tc('error'));
      await loadFolios();
    } finally {
      setBusy(false);
    }
  }

  function renderTender(block: DebtBlock) {
    const isGuest = block.party === 'GUEST';
    const isFirstGuest = block.folio.id === firstGuestBlockId;
    const tenders = isGuest ? guestTenders : payerTenders;
    const rows = linesOf(block);
    return (
      <div className="space-y-2">
        {rows.map((line, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-2">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('method')}
              required
              value={line.method}
              onChange={(v) => setLine(block, idx, { method: String(v ?? '') })}
              options={tenders.map((m) => ({ value: m, label: tPay(m) }))}
              emptyLabel={t('checkoutPickMethod')}
            />
            <Field
              label={tc('amount')}
              preset="amount"
              type="number"
              value={line.amount}
              onChange={(e) => setLine(block, idx, { amount: e.target.value })}
            />
            {line.method === 'CARD' ? (
              terminalOptions.length > 0 ? (
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t('bankTerminal')}
                  required
                  value={line.bankTerminalId}
                  onChange={(v) => setLine(block, idx, { bankTerminalId: String(v ?? '') })}
                  options={terminalOptions}
                  emptyLabel={t('pickTerminal')}
                />
              ) : (
                <p className={`m-0 text-[12px] ${TEXT_DANGER_CLASS}`}>{t('noBankTerminal')}</p>
              )
            ) : null}
            {line.method === 'BANK_TRANSFER' ? (
              <Field
                label={t('bankReference')}
                preset="longText"
                value={line.bankReference}
                onChange={(e) => setLine(block, idx, { bankReference: e.target.value })}
              />
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() =>
              setLines((prev) => ({ ...prev, [block.folio.id]: [...linesOf(block), emptyLine()] }))
            }
          >
            {t('addTenderLine')}
          </button>
        </div>
        {isFirstGuest ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={t('discountAzn')}
              preset="amount"
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const openProcedures = [
    ...(clinic?.paid ?? []).filter((row) => row.status === 'in_plan'),
    ...(clinic?.unpaidExtras ?? []).filter((row) => row.status === 'in_plan'),
  ];
  const factProcedures = (() => {
    const seen = new Set<string>();
    const rows = [
      ...(clinic?.executed ?? []),
      ...(clinic?.paid ?? []),
      ...(clinic?.packageSessions ?? []),
      ...(clinic?.unpaidExtras ?? []),
    ];
    return rows.filter((row) => {
      if (seen.has(row.orderId)) return false;
      seen.add(row.orderId);
      return true;
    });
  })();
  const sanatorium = Boolean(clinic?.medical);
  function chargeForProcedure(row: ClinicProcedure) {
    return folios
      .flatMap((folio) => folio.charges)
      .find((item) => {
        if (!item.externalRef || !row.folioRef) return false;
        const norm = (value: string) => value.trim().replace(/^pay-/, '');
        return norm(item.externalRef) === norm(row.folioRef);
      });
  }
  async function reloadClinic() {
    const again = await fetch(`/api/reservations/${reservationId}/clinic-checkout`);
    const body = await again.json().catch(() => null);
    setClinic((body?.data ?? body) as ClinicCheckout);
    await loadFolios();
  }
  async function voidOneProcedure(row: ClinicProcedure) {
    const charge = chargeForProcedure(row);
    if (!charge?.id) {
      showApiError({ error: t('clinicChargeMissing') }, tc('error'));
      return;
    }
    const res = await fetch(`/api/folios/charges/${charge.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: t('clinicVoid') }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => null), tc('error'));
      return;
    }
    await reloadClinic();
  }
  async function voidOpenProcedures() {
    for (const row of openProcedures) await voidOneProcedure(row);
  }
  async function payOpenProcedures() {
    const amount = openProcedures.reduce((sum, row) => sum + row.amount, 0);
    if (!(amount > 0)) return;
    const res = await fetch('/api/folios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        paymentCategory: 'CLINIC',
        amount: Math.round(amount * 100) / 100,
        paymentMethod: 'CASH',
      }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => null), tc('error'));
      return;
    }
    await reloadClinic();
  }
  const subtitle = [stayGuest, stayRoom].filter(Boolean).join(' · ') || undefined;

  return (
    <>
      <EraModal
        open={open}
        title={t('checkOut')}
        subtitle={subtitle}
        onClose={onClose}
        maxWidthClass="max-w-3xl"
        footer={
          <EraModalFooter
            onCancel={onClose}
            onSubmit={() => {
              setBusy(true);
              void submit().finally(() => setBusy(false));
            }}
            busy={busy}
            submitDisabled={loading || loadFailed || !allChosen || blocksCheckout}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCheckoutChip('money')}>
              {t('checkoutChipMoney')}
            </button>
            {sanatorium && openProcedures.length > 0 ? (
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCheckoutChip('open')}>
                {t('checkoutChipOpen', { count: openProcedures.length })}
              </button>
            ) : null}
            {sanatorium ? (
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setCheckoutChip('fact')}>
                {t('checkoutChipFact')}
              </button>
            ) : null}
          </div>
          {checkoutChip === 'open' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void payOpenProcedures()}>
                  {t('clinicPayAll', { amount: money(openProcedures.reduce((s, row) => s + row.amount, 0)) })}
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void voidOpenProcedures()}>
                  {t('clinicVoidAll')}
                </button>
              </div>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <th className={DATA_TABLE_TD_CLASS}>{t('checkoutWhen')}</th>
                    <th className={DATA_TABLE_TD_CLASS}>{t('checkoutProcedure')}</th>
                    <th className={DATA_TABLE_TD_CLASS}>{t('depositAmount')}</th>
                    <th className={DATA_TABLE_TD_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {openProcedures.map((row) => (
                    <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.scheduledAt)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{money(row.amount)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void voidOneProcedure(row)}>
                          {t('clinicVoid')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {checkoutChip === 'fact' ? (
            <div className="space-y-1">
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <th className={DATA_TABLE_TD_CLASS}>{t('checkoutWhen')}</th>
                    <th className={DATA_TABLE_TD_CLASS}>{t('checkoutProcedure')}</th>
                    <th className={DATA_TABLE_TD_CLASS}>{t('checkoutStatusCol')}</th>
                    <th className={DATA_TABLE_TD_CLASS}>{t('depositAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {factProcedures.map((row) => (
                    <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {bakuDateTimeDisplay(row.checkedInAt || row.scheduledAt)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{t(`clinicStatus_${row.status}`)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.inPackage ? t('clinicFromPackage') : money(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {checkoutChip === 'money' ? (
          <>
          {loading ? <p className={`m-0 ${TEXT_MUTED_CLASS}`}>{tc('loading')}</p> : null}
          {loadFailed ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{tc('loadError')}</p> : null}
          {blocks.map((block) => {
            const choice = choices[block.folio.id] ?? '';
            const isGuest = block.party === 'GUEST';
            const isPayer = block.party === 'AGENCY' || block.party === 'COMPANY';
            const payAllowed = canPay && !block.pendingReversal;
            const payerImpliedByMove = anyMovePayerCl && isPayer;
            if (payerImpliedByMove) {
              return (
                <FieldSection
                  key={block.folio.id}
                  title={block.title}
                  badge={`${money(block.debt)} AZN`}
                >
                  <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>{t('checkoutPayerImpliedByMove')}</p>
                </FieldSection>
              );
            }
            const guestOptions = [
              ...(payAllowed ? [{ value: 'PAY', label: t('checkoutPayNow') }] : []),
              ...(hasPayerOnStay
                ? [
                    {
                      value: 'MOVE_PAYER_CL',
                      label: t('checkoutMovePayerCl', {
                        payer: suggestedPayerName,
                        amount: money(block.debt),
                      }),
                    },
                  ]
                : []),
              { value: 'DEBT', label: t('checkoutLeaveGuestDebt') },
            ];
            const payerOptions = [
              ...(payAllowed ? [{ value: 'PAY', label: t('checkoutPayNow') }] : []),
              { value: 'CL', label: t('checkoutToCityLedger') },
            ];
            return (
              <FieldSection
                key={block.folio.id}
                title={block.title}
                badge={`${money(block.credit > 0.01 ? block.credit : block.debt)} AZN`}
              >
                <div className="space-y-3">
                  {(() => {
                    const split = categorySplit(block.folio);
                    const serviceTotal = PAYMENT_CATEGORIES.reduce((sum, cat) => sum + split.services[cat], 0);
                    const paidTotal = PAYMENT_CATEGORIES.reduce((sum, cat) => sum + split.paid[cat], 0);
                    return (
                      <table className={DATA_TABLE_CLASS}>
                        <thead>
                          <tr className={DATA_TABLE_TR_CLASS}>
                            <th className={DATA_TABLE_TD_CLASS}>{t('folioCategory')}</th>
                            <th className={DATA_TABLE_TD_CLASS}>{t('checkoutServices')}</th>
                            <th className={DATA_TABLE_TD_CLASS}>{t('checkoutPaymentsCol')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PAYMENT_CATEGORIES.map((cat) => (
                            <tr key={cat} className={DATA_TABLE_TR_CLASS}>
                              <td className={DATA_TABLE_TD_CLASS}>{t(`paymentCategory_${cat}`)}</td>
                              <td className={DATA_TABLE_TD_CLASS}>{money(split.services[cat])}</td>
                              <td className={DATA_TABLE_TD_CLASS}>{money(split.paid[cat])}</td>
                            </tr>
                          ))}
                          <tr className={DATA_TABLE_TR_CLASS}>
                            <td className={DATA_TABLE_TD_CLASS}>{t('checkoutServiceTotal')}</td>
                            <td className={DATA_TABLE_TD_CLASS}>{money(serviceTotal)}</td>
                            <td className={DATA_TABLE_TD_CLASS}>{money(paidTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                  {block.credit > 0.01 ? (
                    <>
                    <CatalogField
                      kind="OPS_HOT"
                      label={t('surplusRefund')}
                      required
                      value={lines[block.folio.id]?.[0]?.method ?? ''}
                      onChange={(v) =>
                        setLines((prev) => ({
                          ...prev,
                          [block.folio.id]: [
                            {
                              ...(prev[block.folio.id]?.[0] ?? emptyLine(money(block.credit))),
                              method: String(v ?? ''),
                              amount: money(block.credit),
                            },
                          ],
                        }))
                      }
                      options={[
                        { value: 'CASH', label: tPay('CASH') },
                        { value: 'CARD', label: tPay('CARD') },
                      ]}
                      emptyLabel={null}
                    />
                    {lines[block.folio.id]?.[0]?.method === 'CARD' && terminalOptions.length > 0 ? (
                      <CatalogField
                        kind="CLOSED_SMALL"
                        label={t('bankTerminal')}
                        required
                        value={lines[block.folio.id]?.[0]?.bankTerminalId ?? ''}
                        onChange={(v) =>
                          setLines((prev) => ({
                            ...prev,
                            [block.folio.id]: [
                              {
                                ...(prev[block.folio.id]?.[0] ?? emptyLine(money(block.credit))),
                                bankTerminalId: String(v ?? ''),
                              },
                            ],
                          }))
                        }
                        options={terminalOptions}
                        emptyLabel={t('pickTerminal')}
                      />
                    ) : null}
                    </>
                  ) : null}
                  {block.credit > 0.01 ? null : (
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('checkoutChoice')}
                    required
                    value={choice}
                    onChange={(v) => {
                      setError('');
                      const next = String(v ?? '') as Choice;
                      setChoices((prev) => {
                        const updated = { ...prev, [block.folio.id]: next };
                        if (next === 'MOVE_PAYER_CL') {
                          for (const other of blocks) {
                            if (other.party === 'AGENCY' || other.party === 'COMPANY') {
                              updated[other.folio.id] = 'CL';
                            }
                          }
                        }
                        return updated;
                      });
                    }}
                    options={isGuest ? guestOptions : payerOptions}
                    emptyLabel={null}
                  />
                  )}
                  {!canPay ? (
                    <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>{t('checkoutNoPaymentRight')}</p>
                  ) : block.pendingReversal ? (
                    <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>{t('checkoutPayerEarlyHint')}</p>
                  ) : null}
                  {choice ? (
                    <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {choice === 'PAY'
                        ? isGuest
                          ? t('checkoutGuestPayHint')
                          : t('checkoutPayerPayHint')
                        : choice === 'DEBT'
                          ? t('checkoutGuestDebtHint')
                          : choice === 'MOVE_PAYER_CL'
                            ? t('checkoutMovePayerClHint', {
                                payer: suggestedPayerName,
                                kind: suggestedPayerKind === 'COMPANY' ? t('checkoutPayerCompany') : t('checkoutPayerAgency'),
                              })
                            : t('checkoutClHint')}
                    </p>
                  ) : null}
                  {choice === 'PAY' ? renderTender(block) : null}
                </div>
              </FieldSection>
            );
          })}
          <p className="m-0 font-mono text-[13px]">
            {t('checkoutStayNet')}: {money(blocks.reduce((sum, block) => sum + block.debt - block.credit, 0))}
          </p>
          {anyGuestDebt ? (
            <FieldTextarea
              label={t('guestDebtNote')}
              required
              value={guestDebtNote}
              onChange={(e) => setGuestDebtNote(e.target.value)}
            />
          ) : null}
          {early?.applicable ? (
            <FieldSection title={t('earlyCheckoutTitle')}>
              <div className="space-y-1">
                <p className="m-0">{t('earlyCheckoutNights', { count: early.unusedNights })}</p>
                <p className="m-0">{t('earlyCheckoutGross', { amount: money(early.unusedSellGross) })}</p>
                <p className="m-0">{t('earlyCheckoutVat', { amount: money(early.vatWithheld) })}</p>
                <p className="m-0">{t('earlyCheckoutCash', { amount: money(early.guestCashRefund) })}</p>
                {refundNeeded ? (
                  <div className="flex flex-wrap items-end gap-2 pt-2">
                    <CatalogField
                      kind="OPS_HOT"
                      label={t('earlyCheckoutTender')}
                      required
                      value={refundMethod}
                      onChange={(v) => setRefundMethod(String(v ?? ''))}
                      options={[
                        { value: 'CASH', label: tPay('CASH') },
                        { value: 'CARD', label: tPay('CARD') },
                      ]}
                      emptyLabel={null}
                    />
                    {refundMethod === 'CARD' ? (
                      terminalOptions.length > 0 ? (
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t('bankTerminal')}
                          required
                          value={refundTerminal}
                          onChange={(v) => setRefundTerminal(String(v ?? ''))}
                          options={terminalOptions}
                          emptyLabel={t('pickTerminal')}
                        />
                      ) : (
                        <p className={`m-0 text-[12px] ${TEXT_DANGER_CLASS}`}>{t('noBankTerminal')}</p>
                      )
                    ) : null}
                    <Field
                      label={t('earlyCheckoutReason')}
                      preset="longText"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </FieldSection>
          ) : null}
          </>
          ) : null}
          {error ? (
            <p className={`m-0 ${TEXT_DANGER_CLASS}`} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </EraModal>
      <EraModal
        open={laundry.length > 0}
        title={tHk('laundryOpenCheckout')}
        onClose={() => {
          setLaundry([]);
          setLaundryTicketId('');
          setLaundryScan('');
        }}
      >
        <p className="mb-2 text-[13px] text-[#7F8C8D]">{tHk('laundryOpenCheckoutHint')}</p>
        <ul className="mb-3 space-y-2 text-[13px]">
          {laundry.map((tk) => (
            <li
              key={tk.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#ECF0F1] px-2 py-1.5"
            >
              <span>
                {tk.roomNumber ? `${tHk('laundryRoom')} ${tk.roomNumber} · ` : ''}
                {tk.guestName}
              </span>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={laundryBusy}
                onClick={() => {
                  setLaundryBusy(true);
                  void fetch('/api/housekeeping/laundry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voidTicketId: tk.id }),
                  })
                    .then(async (res) => {
                      if (!res.ok) {
                        showApiError(await res.json(), tc('error'));
                        return;
                      }
                      const remaining = laundry.filter((row) => row.id !== tk.id);
                      setLaundry(remaining);
                      setLaundryTicketId(remaining[0]?.id ?? '');
                      setLaundryScan('');
                      await loadFolios();
                      if (remaining.length === 0) {
                        showSuccess(tHk('laundryVoidedContinueCheckout'));
                        setBusy(true);
                        try {
                          await submit();
                        } finally {
                          setBusy(false);
                        }
                      } else {
                        showSuccess(tHk('laundryDeliveredMoreOpen'));
                      }
                    })
                    .finally(() => setLaundryBusy(false));
                }}
              >
                {tHk('voidLaundryTicket')}
              </button>
            </li>
          ))}
        </ul>
        {laundry.length > 1 ? (
          <div className="mb-2">
            <CatalogField
              kind="CLOSED_SMALL"
              label={tHk('laundryGuest')}
              value={laundryTicketId || laundry[0]?.id || ''}
              onChange={(v) => setLaundryTicketId(String(v))}
              options={laundry.map((tk) => ({
                value: tk.id,
                label: `${tk.roomNumber ? `${tk.roomNumber} · ` : ''}${tk.guestName}`,
              }))}
            />
          </div>
        ) : null}
        <input
          type="file"
          className={`mb-2 text-xs ${FORM_INPUT_CLASS}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setLaundryScan(String(reader.result ?? file.name));
            reader.readAsDataURL(file);
          }}
        />
        <EraModalFooter
          onCancel={() => {
            setLaundry([]);
            setLaundryTicketId('');
            setLaundryScan('');
          }}
          cancelLabel={tHk('waitLaundry')}
          submitLabel={tHk('deliverLaundry')}
          busy={laundryBusy}
          onSubmit={() => {
            const targetId = laundryTicketId || laundry[0]?.id;
            const target = laundry.find((tk) => tk.id === targetId) ?? laundry[0];
            if (!target || !laundryScan) {
              showApiError({ error: tHk('returnScanRequired') }, tc('error'));
              return;
            }
            setLaundryBusy(true);
            void fetch('/api/housekeeping/laundry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deliverTicketId: target.id,
                returnScanKey: laundryScan,
                actorRole: 'FO',
              }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  showApiError(await res.json(), tc('error'));
                  return;
                }
                const remaining = laundry.filter((tk) => tk.id !== target.id);
                setLaundryScan('');
                setLaundry(remaining);
                setLaundryTicketId(remaining[0]?.id ?? '');
                await loadFolios();
                if (remaining.length === 0) {
                  showSuccess(tHk('laundryDeliveredContinueCheckout'));
                  setBusy(true);
                  try {
                    await submit();
                  } finally {
                    setBusy(false);
                  }
                } else {
                  showSuccess(tHk('laundryDeliveredMoreOpen'));
                }
              })
              .finally(() => setLaundryBusy(false));
          }}
        />
      </EraModal>
    </>
  );
}
