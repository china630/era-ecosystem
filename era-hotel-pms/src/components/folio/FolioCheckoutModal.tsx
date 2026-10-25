'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
  Field,
  FieldSection,
  FieldTextarea,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  parseApiError,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { stayMoneyPair } from '@/lib/folio-money-pair';
import { earlyReversalByFolio } from '@/lib/early-checkout-reversal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function sameChargeRef(stored: string | null | undefined, folioRef: string | null): boolean {
  if (!stored || !folioRef) return false;
  const norm = (value: string) => value.trim().replace(/^pay-/, '');
  return norm(stored) === norm(folioRef);
}

const GUEST_TENDERS = ['CASH', 'CARD', 'BANK_TRANSFER', 'LOYALTY_POINTS'] as const;
const PAYER_TENDERS = ['CASH', 'CARD', 'BANK_TRANSFER'] as const;

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
    agency?: { name?: string | null } | null;
    company?: { name?: string | null } | null;
  } | null;
  charges: Array<{
    id?: string;
    externalRef?: string | null;
    description?: string | null;
    amount: number | string;
    qty?: number | null;
    businessDate?: string;
    revenueCode?: {
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
};

type ClinicCheckout = {
  medical: boolean;
  unavailable?: boolean;
  paid?: ClinicProcedure[];
  packageSessions?: ClinicProcedure[];
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

type Choice = '' | 'PAY' | 'DEBT' | 'CL';

type TenderLine = { method: string; amount: string; bankReference: string; bankTerminalId: string };

type DebtBlock = {
  folio: FolioRow;
  party: 'GUEST' | 'AGENCY' | 'COMPANY';
  title: string;
  debt: number;
  /** Early checkout voids lodging on this payer folio; settle would see the pre-void balance. */
  pendingReversal: boolean;
};

function emptyLine(amount = ''): TenderLine {
  return { method: '', amount, bankReference: '', bankTerminalId: '' };
}

function money(n: number): string {
  return n.toFixed(2);
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
  const [busy, setBusy] = useState(false);
  const [clinic, setClinic] = useState<ClinicCheckout | null>(null);
  const [laundry, setLaundry] = useState<Array<{ id: string; guestName: string }>>([]);
  const [laundryScan, setLaundryScan] = useState('');

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
      const debt = Math.round((stayMoneyPair(folio.charges, folio.payments ?? []).debt - reversed) * 100) / 100;
      if (debt <= 0.01) continue;
      if (folio.type === 'GUEST') {
        const rg = folio.reservationGuest;
        const own =
          rg?.guest?.fullName?.trim() || [rg?.firstName, rg?.lastName].filter(Boolean).join(' ').trim();
        out.push({
          folio,
          party: 'GUEST',
          title: t('checkoutGuestBlock', { name: own || stayGuest || '—' }),
          debt,
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
          pendingReversal: reversed > 0.01,
        });
      }
    }
    return out.sort((a, b) => (a.party === 'GUEST' ? 0 : 1) - (b.party === 'GUEST' ? 0 : 1));
  }, [folios, early, stayGuest, t]);

  const firstGuestBlockId = blocks.find((b) => b.party === 'GUEST')?.folio.id;
  const anyGuestDebt = blocks.some((b) => choices[b.folio.id] === 'DEBT');
  const allChosen = blocks.every((b) => Boolean(choices[b.folio.id]));
  const unusedPayment = useMemo(() => {
    return folios
      .filter((folio) => folio.status === 'OPEN')
      .reduce((sum, folio) => sum + stayMoneyPair(folio.charges, folio.payments ?? []).unused, 0);
  }, [folios]);
  const refundNeeded = Boolean(early?.applicable && early.guestCashRefund > 0);
  const blocksCheckout = Boolean(clinic?.medical && clinic.blocksCheckout);

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
    return `${block.title}: ${parseApiError(await res.json().catch(() => null), tc('error'))}`;
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
        setError(failed);
        await loadFolios();
        return;
      }
    }
    const res = await fetch(`/api/reservations/${reservationId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferToCityLedger: blocks.some((b) => choices[b.folio.id] === 'CL'),
        transferToGuestDebt: anyGuestDebt,
        guestDebtNote: anyGuestDebt ? guestDebtNote.trim() : undefined,
        unusedNightsRefundMethod: refundNeeded ? refundMethod : undefined,
        unusedNightsBankTerminalId: refundNeeded && refundMethod === 'CARD' ? refundTerminal : undefined,
        unusedNightsReason: early?.applicable && refundReason.trim() ? refundReason.trim() : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const payload = data.data ?? data;
    if (res.ok) {
      onDone?.();
      onClose();
      showSuccess(
        payload.cityLedgerTransferred?.length
          ? t('checkoutClSuccess', { count: payload.cityLedgerTransferred.length })
          : t('checkoutSuccess'),
      );
      return;
    }
    if (payload.code === 'LAUNDRY_OPEN' && Array.isArray(payload.tickets)) {
      setLaundry(payload.tickets);
      onClose();
      return;
    }
    setError(parseApiError(data, tc('error')));
    await loadFolios();
  }

  function renderTender(block: DebtBlock) {
    const isGuest = block.party === 'GUEST';
    const isFirstGuest = block.folio.id === firstGuestBlockId;
    const tenders = isGuest ? GUEST_TENDERS : PAYER_TENDERS;
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
            submitDisabled={loading || loadFailed || !allChosen || blocksCheckout || unusedPayment > 0.01}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          {clinic?.medical ? (
            <div className="space-y-2">
              {clinic.unavailable ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{t('clinicUnavailable')}</p> : null}
              {blocksCheckout ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{t('clinicBlocksCheckout')}</p> : null}
              <p className="m-0 font-medium">{t('clinicPaidTitle')}</p>
              <table className={DATA_TABLE_CLASS}>
                <tbody>
                  {(clinic.paid ?? []).map((row) => {
                    const charge = folios
                      .flatMap((folio) => folio.charges)
                      .find((item) => sameChargeRef(item.externalRef, row.folioRef));
                    return (
                      <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{money(row.amount)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{t(`clinicStatus_${row.status}`)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.status === 'in_plan' && charge?.id ? (
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                const reason = t('clinicVoid');
                                void fetch(`/api/folios/charges/${charge.id}/void`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ reason }),
                                }).then(async (res) => {
                                  if (!res.ok) {
                                    showApiError(await res.json().catch(() => null), tc('error'));
                                    return;
                                  }
                                  await loadFolios();
                                  const again = await fetch(`/api/reservations/${reservationId}/clinic-checkout`);
                                  const body = await again.json().catch(() => null);
                                  setClinic((body?.data ?? body) as ClinicCheckout);
                                });
                              }}
                            >
                              {t('clinicVoid')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="m-0 font-medium">{t('clinicPackageTitle')}</p>
              <table className={DATA_TABLE_CLASS}>
                <tbody>
                  {(clinic.packageSessions ?? []).map((row) => (
                    <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{t(`clinicStatus_${row.status}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {unusedPayment > 0.01 ? (
            <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{t('checkoutUnused', { amount: money(unusedPayment) })}</p>
          ) : null}
          <FieldSection title={t('checkoutTotals')}>
            <div className="grid grid-cols-2 gap-2 font-mono text-[13px]">
              <div>
                <div className={TEXT_MUTED_CLASS}>{t('guestOwes')}</div>
                <div>{money(blocks.reduce((sum, block) => sum + block.debt, 0))}</div>
              </div>
              <div>
                <div className={TEXT_MUTED_CLASS}>{t('overpaid')}</div>
                <div>{money(unusedPayment)}</div>
              </div>
            </div>
          </FieldSection>
          {loading ? <p className={`m-0 ${TEXT_MUTED_CLASS}`}>{tc('loading')}</p> : null}
          {loadFailed ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{tc('loadError')}</p> : null}
          {blocks.map((block) => {
            const choice = choices[block.folio.id] ?? '';
            const isGuest = block.party === 'GUEST';
            const payAllowed = canPay && !block.pendingReversal;
            return (
              <FieldSection
                key={block.folio.id}
                title={block.title}
                badge={`${money(block.debt)} AZN`}
              >
                <div className="space-y-3">
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('checkoutChoice')}
                    required
                    value={choice}
                    onChange={(v) => {
                      setError('');
                      setChoices((prev) => ({ ...prev, [block.folio.id]: String(v ?? '') as Choice }));
                    }}
                    options={[
                      ...(payAllowed ? [{ value: 'PAY', label: t('checkoutPayNow') }] : []),
                      isGuest
                        ? { value: 'DEBT', label: t('checkoutLeaveGuestDebt') }
                        : { value: 'CL', label: t('checkoutToCityLedger') },
                    ]}
                    emptyLabel={null}
                  />
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
                          : t('checkoutClHint')}
                    </p>
                  ) : null}
                  {choice === 'PAY' ? renderTender(block) : null}
                </div>
              </FieldSection>
            );
          })}
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
          {error ? (
            <p className={`m-0 ${TEXT_DANGER_CLASS}`} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </EraModal>
      <EraModal open={laundry.length > 0} title={tHk('laundryOpenCheckout')} onClose={() => setLaundry([])}>
        <ul className="mb-3 text-[13px]">
          {laundry.map((tk) => (
            <li key={tk.id}>{tk.guestName}</li>
          ))}
        </ul>
        <input
          type="file"
          className="mb-2 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setLaundryScan(String(reader.result ?? file.name));
            reader.readAsDataURL(file);
          }}
        />
        <EraModalFooter
          onCancel={() => setLaundry([])}
          cancelLabel={tHk('waitLaundry')}
          submitLabel={tHk('deliverLaundry')}
          onSubmit={() => {
            const first = laundry[0];
            if (!first || !laundryScan) {
              showApiError({ error: tHk('returnScanRequired') }, tc('error'));
              return;
            }
            void fetch('/api/housekeeping/laundry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deliverTicketId: first.id, returnScanKey: laundryScan, actorRole: 'FO' }),
            }).then(async (res) => {
              if (!res.ok) showApiError(await res.json(), tc('error'));
              else {
                showSuccess(tc('saved'));
                setLaundry([]);
                onDone?.();
              }
            });
          }}
        />
      </EraModal>
    </>
  );
}
