'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
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
import { folioArticleSummary } from '@/lib/folio-article-summary';
import { accountBalance } from '@/lib/folio-payer';

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

type EarlyPreview = {
  applicable: boolean;
  unusedNights: number;
  unusedSellGross: number;
  vatWithheld: number;
  guestCashRefund: number;
};

type Choice = '' | 'PAY' | 'DEBT' | 'CL';

type TenderLine = { method: string; amount: string; bankReference: string; bankTerminalId: string };

type DebtBlock = {
  folio: FolioRow;
  party: 'GUEST' | 'AGENCY' | 'COMPANY';
  title: string;
  debt: number;
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
  const locale = useLocale();
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [lines, setLines] = useState<Record<string, TenderLine[]>>({});
  const [guestDebtNote, setGuestDebtNote] = useState('');
  const [heldDeposits, setHeldDeposits] = useState(0);
  const [applyDeposits, setApplyDeposits] = useState(true);
  const [discountAmount, setDiscountAmount] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [early, setEarly] = useState<EarlyPreview | null>(null);
  const [refundMethod, setRefundMethod] = useState('');
  const [refundTerminal, setRefundTerminal] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remainder, setRemainder] = useState<{ ids: string[]; amount: number } | null>(null);
  const [remainderMethod, setRemainderMethod] = useState('');
  const [remainderTerminal, setRemainderTerminal] = useState('');
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
    setApplyDeposits(true);
    setHeldDeposits(0);
    setEarly(null);
    setRefundMethod('');
    setRefundTerminal('');
    setRefundReason('');
    setError('');
    void loadFolios().then((rows) => {
      const guest = rows.find((f) => f.type === 'GUEST' && f.status === 'OPEN');
      if (!guest) return;
      void fetch(`/api/folios/settle?folioId=${guest.id}`)
        .then((r) => r.json())
        .then((data) => {
          const payload = data.data ?? data;
          if (payload?.heldDeposits != null) setHeldDeposits(Number(payload.heldDeposits));
        })
        .catch(() => null);
    });
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
      const debt = accountBalance(folio);
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
        });
      }
    }
    return out.sort((a, b) => (a.party === 'GUEST' ? 0 : 1) - (b.party === 'GUEST' ? 0 : 1));
  }, [folios, stayGuest, t]);

  const firstGuestBlockId = blocks.find((b) => b.party === 'GUEST')?.folio.id;
  const anyGuestDebt = blocks.some((b) => choices[b.folio.id] === 'DEBT');
  const allChosen = blocks.every((b) => Boolean(choices[b.folio.id]));
  const refundNeeded = Boolean(early?.applicable && early.guestCashRefund > 0);

  const terminalOptions = bankTerminals.map((row) => ({ value: row.id, label: row.label }));

  function linesOf(block: DebtBlock): TenderLine[] {
    return lines[block.folio.id] ?? [emptyLine(money(block.debt))];
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
      const rows = linesOf(block).filter((l) => Number(l.amount) > 0);
      if (rows.some((l) => !l.method)) return t('checkoutPickMethod');
      if (rows.some((l) => l.method === 'CARD' && !l.bankTerminalId)) return t('checkoutPickTerminal');
      const paid = rows.reduce((s, l) => s + Number(l.amount), 0);
      const isFirstGuest = block.folio.id === firstGuestBlockId;
      const deposits = isFirstGuest && applyDeposits ? heldDeposits : 0;
      const discount = isFirstGuest && discountAmount ? Number(discountAmount) : 0;
      if (paid + deposits + discount + 0.01 < block.debt) {
        return t('checkoutTenderShort', {
          name: block.title,
          paid: money(paid + deposits + discount),
          due: money(block.debt),
        });
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
    if (tender.length === 0 && isFirstGuest && applyDeposits && heldDeposits > 0.01) {
      tender.push({
        method: 'DEPOSIT',
        amount: Math.min(heldDeposits, block.debt),
        bankReference: undefined,
        bankTerminalId: undefined,
      });
    }
    if (tender.length === 0) return null;
    const res = await fetch('/api/folios/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folioId: block.folio.id,
        lines: tender,
        applyDeposits: isFirstGuest ? applyDeposits : false,
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
      const held = payload.depositRemainder as { heldAmount?: number; heldIds?: string[] } | undefined;
      const heldAmount = Number(held?.heldAmount ?? 0);
      const heldIds = Array.isArray(held?.heldIds) ? held.heldIds : [];
      onDone?.();
      onClose();
      if (heldAmount > 0.01 && heldIds.length > 0) {
        setRemainder({ ids: heldIds, amount: heldAmount });
        setRemainderMethod('');
        setRemainderTerminal('');
        return;
      }
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

  function renderSummary(folio: FolioRow) {
    const allocatedByChargeId: Record<string, number> = {};
    for (const charge of folio.charges) {
      if (!charge.id) continue;
      allocatedByChargeId[charge.id] = (charge.paymentAllocations ?? []).reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      );
    }
    const summary = folioArticleSummary({
      charges: folio.charges.map((charge) => ({ ...charge, id: charge.id ?? '' })),
      payments: folio.payments ?? [],
      locale,
      allocatedByChargeId,
    });
    const rows = summary.rows.filter((row) => Math.abs(row.debt) > 0.01);
    if (rows.length === 0) return null;
    return (
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('summaryArticle')}</th>
            <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t('summaryCharged')}</th>
            <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t('summaryPaid')}</th>
            <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t('summaryDebt')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS}>{row.label}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{money(row.charged)}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{money(row.paid)}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right font-mono`}>{money(row.debt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
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
            {heldDeposits > 0.01 ? (
              <label className="inline-flex items-center gap-1.5 pb-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={applyDeposits}
                  onChange={(e) => setApplyDeposits(e.target.checked)}
                />
                {t('applyHeldDeposits')} ({money(heldDeposits)} AZN)
              </label>
            ) : null}
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
            submitDisabled={loading || loadFailed || !allChosen}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          {loading ? <p className={`m-0 ${TEXT_MUTED_CLASS}`}>{tc('loading')}</p> : null}
          {loadFailed ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{tc('loadError')}</p> : null}
          {!loading && !loadFailed && blocks.length === 0 ? (
            <p className="m-0">{t('checkoutNoDebt')}</p>
          ) : null}
          {blocks.map((block) => {
            const choice = choices[block.folio.id] ?? '';
            const isGuest = block.party === 'GUEST';
            return (
              <FieldSection
                key={block.folio.id}
                title={block.title}
                badge={`${money(block.debt)} AZN`}
              >
                <div className="space-y-3">
                  {renderSummary(block.folio)}
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('checkoutChoice')}
                    required
                    value={choice}
                    onChange={(v) => {
                      setError('');
                      setChoices((prev) => ({ ...prev, [block.folio.id]: String(v ?? '') as Choice }));
                    }}
                    options={
                      isGuest
                        ? [
                            { value: 'PAY', label: t('checkoutPayNow') },
                            { value: 'DEBT', label: t('checkoutLeaveGuestDebt') },
                          ]
                        : [
                            { value: 'PAY', label: t('checkoutPayNow') },
                            { value: 'CL', label: t('checkoutToCityLedger') },
                          ]
                    }
                    emptyLabel={null}
                  />
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
      <EraModal
        open={remainder != null}
        title={t('depositRemainderTitle')}
        onClose={() => setRemainder(null)}
        footer={
          <EraModalFooter
            onCancel={() => {
              if (!remainder) return;
              setBusy(true);
              void Promise.all(
                remainder.ids.map((depositId) =>
                  fetch(`/api/reservations/${reservationId}/deposits/settle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ depositId, action: 'carry' }),
                  }),
                ),
              )
                .then(() => {
                  showSuccess(t('depositCarry'));
                  setRemainder(null);
                })
                .finally(() => setBusy(false));
            }}
            cancelLabel={t('depositCarry')}
            submitLabel={t('depositPayout')}
            busy={busy}
            submitDisabled={!remainderMethod || (remainderMethod === 'CARD' && !remainderTerminal)}
            onSubmit={() => {
              if (!remainder) return;
              setBusy(true);
              void Promise.all(
                remainder.ids.map((depositId) =>
                  fetch(`/api/reservations/${reservationId}/deposits/settle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      depositId,
                      action: 'payout',
                      paymentMethod: remainderMethod,
                      bankTerminalId: remainderMethod === 'CARD' ? remainderTerminal || undefined : undefined,
                    }),
                  }).then(async (res) => {
                    if (!res.ok) throw await res.json();
                  }),
                ),
              )
                .then(() => {
                  showSuccess(t('depositPayout'));
                  setRemainder(null);
                })
                .catch((err) => showApiError(err, tc('error')))
                .finally(() => setBusy(false));
            }}
          />
        }
      >
        <div className="space-y-2">
          <p className="m-0 text-[13px]">{t('depositRemainderHint', { amount: money(remainder?.amount ?? 0) })}</p>
          <CatalogField
            kind="OPS_HOT"
            label={t('method')}
            required
            value={remainderMethod}
            onChange={(v) => setRemainderMethod(String(v ?? ''))}
            options={[
              { value: 'CASH', label: tPay('CASH') },
              { value: 'CARD', label: tPay('CARD') },
            ]}
            emptyLabel={null}
          />
          {remainderMethod === 'CARD' && terminalOptions.length > 0 ? (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('bankTerminal')}
              required
              value={remainderTerminal}
              onChange={(v) => setRemainderTerminal(String(v ?? ''))}
              options={terminalOptions}
              emptyLabel={t('pickTerminal')}
            />
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
