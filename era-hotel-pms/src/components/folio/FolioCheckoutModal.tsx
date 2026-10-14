'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  FieldTextarea,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { folioArticleSummary } from '@/lib/folio-article-summary';
import { accountBalance } from '@/lib/folio-payer';

const TENDERS = ['CASH', 'CARD', 'BANK_TRANSFER', 'DEPOSIT', 'LOYALTY_POINTS', 'COMPANY_ACCOUNT'] as const;

type FolioRow = {
  id: string;
  type: string;
  status: string;
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

export function FolioCheckoutModal({
  open,
  onClose,
  onDone,
  reservationId,
  folios,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reservationId: string;
  folios: FolioRow[];
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const tHk = useTranslations('housekeeping');
  const locale = useLocale();
  const guest = folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN') ?? folios.find((f) => f.type === 'GUEST');
  const balance = guest ? accountBalance(guest) : 0;
  const [transferToCl, setTransferToCl] = useState(false);
  const [guestMode, setGuestMode] = useState<'PAY' | 'DEBT'>('PAY');
  const [guestDebtNote, setGuestDebtNote] = useState('');
  const [heldDeposits, setHeldDeposits] = useState(0);
  const [applyDeposits, setApplyDeposits] = useState(true);
  const [discountAmount, setDiscountAmount] = useState('');
  const [lines, setLines] = useState<
    { method: string; amount: string; bankReference: string; bankTerminalId: string }[]
  >([{ method: 'CASH', amount: '', bankReference: '', bankTerminalId: '' }]);
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [early, setEarly] = useState<EarlyPreview | null>(null);
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundTerminal, setRefundTerminal] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [remainder, setRemainder] = useState<{ ids: string[]; amount: number } | null>(null);
  const [remainderMethod, setRemainderMethod] = useState('CASH');
  const [remainderTerminal, setRemainderTerminal] = useState('');
  const [laundry, setLaundry] = useState<Array<{ id: string; guestName: string }>>([]);
  const [laundryScan, setLaundryScan] = useState('');

  useEffect(() => {
    if (!open) return;
    setTransferToCl(false);
    setGuestMode('PAY');
    setGuestDebtNote('');
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        setBankTerminals(body?.devices ?? []);
      })
      .catch(() => setBankTerminals([]));
    setEarly(null);
    setRefundMethod('CASH');
    setRefundReason('');
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
    if (guest) {
      void fetch(`/api/folios/settle?folioId=${guest.id}`)
        .then((r) => r.json())
        .then((data) => {
          const payload = data.data ?? data;
          if (payload?.heldDeposits != null) setHeldDeposits(Number(payload.heldDeposits));
        })
        .catch(() => null);
    }
  }, [open, reservationId, guest?.id]);

  const summary = useMemo(() => {
    if (!guest) return null;
    const allocatedByChargeId: Record<string, number> = {};
    for (const charge of guest.charges) {
      if (!charge.id) continue;
      allocatedByChargeId[charge.id] = (charge.paymentAllocations ?? []).reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      );
    }
    return folioArticleSummary({
      charges: guest.charges.map((charge) => ({ ...charge, id: charge.id ?? '' })),
      payments: guest.payments ?? [],
      locale,
      allocatedByChargeId,
    });
  }, [guest, locale]);

  const terminalOptions = [
    { value: '', label: t('pickTerminal') },
    ...bankTerminals.map((row) => ({ value: row.id, label: row.label })),
  ];

  async function settleThenCheckout() {
    const cardMissingTerminal =
      (guestMode === 'PAY' &&
        lines.some((line) => line.method === 'CARD' && Number(line.amount) > 0 && !line.bankTerminalId.trim())) ||
      (early?.applicable && early.guestCashRefund > 0 && refundMethod === 'CARD' && !refundTerminal.trim());
    if (cardMissingTerminal) {
      showApiError({ error: t('bankTerminal') }, tc('error'));
      return false;
    }
    if (guestMode === 'DEBT' && balance > 0.01 && !guestDebtNote.trim()) {
      showApiError({ error: t('guestDebtNote') }, tc('error'));
      return false;
    }
    if (guest && balance > 0.01 && guestMode === 'PAY') {
      const tender = lines
        .map((l) => ({
          method: l.method,
          amount: Number(l.amount),
          bankReference: l.method === 'BANK_TRANSFER' && l.bankReference.trim() ? l.bankReference.trim() : undefined,
          bankTerminalId: l.method === 'CARD' ? l.bankTerminalId.trim() || undefined : undefined,
        }))
        .filter((l) => l.amount > 0);
      if (tender.length === 0 && applyDeposits && heldDeposits > 0.01) {
        tender.push({ method: 'DEPOSIT', amount: heldDeposits, bankReference: undefined, bankTerminalId: undefined });
      }
      if (tender.length > 0) {
        const res = await fetch('/api/folios/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folioId: guest.id,
            lines: tender,
            applyDeposits,
            discountAmount: discountAmount ? Number(discountAmount) : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('error'));
          return false;
        }
      }
    }
    const res = await fetch(`/api/reservations/${reservationId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferToCityLedger: transferToCl,
        transferToGuestDebt: guestMode === 'DEBT' && balance > 0.01,
        guestDebtNote: guestMode === 'DEBT' ? guestDebtNote.trim() : undefined,
        discountAmount: discountAmount ? Number(discountAmount) : undefined,
        unusedNightsRefundMethod: early?.applicable && early.guestCashRefund > 0 ? refundMethod : undefined,
        unusedNightsBankTerminalId:
          early?.applicable && early.guestCashRefund > 0 && refundMethod === 'CARD'
            ? refundTerminal.trim() || undefined
            : undefined,
        unusedNightsReason: early?.applicable && refundReason.trim() ? refundReason.trim() : undefined,
      }),
    });
    const data = await res.json();
    const payload = data.data ?? data;
    if (res.ok) {
      const held = payload.depositRemainder as { heldAmount?: number; heldIds?: string[] } | undefined;
      const heldAmount = Number(held?.heldAmount ?? 0);
      const heldIds = Array.isArray(held?.heldIds) ? held.heldIds : [];
      if (heldAmount > 0.01 && heldIds.length > 0) {
        setRemainder({ ids: heldIds, amount: heldAmount });
        setRemainderMethod('CASH');
        onDone?.();
        onClose();
        return true;
      }
      showSuccess(
        payload.cityLedgerTransferred?.length
          ? t('checkoutClSuccess', { count: payload.cityLedgerTransferred.length })
          : t('checkoutSuccess'),
      );
      onDone?.();
      onClose();
      return true;
    }
    if (payload.code === 'LAUNDRY_OPEN' && Array.isArray(payload.tickets)) {
      setLaundry(payload.tickets);
      onClose();
      return false;
    }
    showApiError(data, tc('error'));
    return false;
  }

  return (
    <>
      <EraModal
        open={open}
        title={t('checkOut')}
        onClose={onClose}
        footer={
          <EraModalFooter
            onCancel={onClose}
            onSubmit={() => {
              setBusy(true);
              void settleThenCheckout().finally(() => setBusy(false));
            }}
            busy={busy}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-3 text-[13px] text-[#34495E]">
          <p className="m-0">
            {t('totalBalance')} <strong>{balance.toFixed(2)} AZN</strong>{' '}
            {Math.abs(balance) < 0.01 ? t('readyCheckout') : t('paymentRequired')}
          </p>
          {summary && summary.rows.length > 0 ? (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[#7F8C8D]">
                  <th className="py-1 pr-2 font-medium">{t('summaryArticle')}</th>
                  <th className="py-1 pr-2 text-right font-medium">{t('summaryCharged')}</th>
                  <th className="py-1 pr-2 text-right font-medium">{t('summaryPaid')}</th>
                  <th className="py-1 text-right font-medium">{t('summaryDebt')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-1 pr-2">{row.label}</td>
                    <td className="py-1 pr-2 text-right font-mono">{row.charged.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{row.paid.toFixed(2)}</td>
                    <td className="py-1 text-right font-mono">{row.debt.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1 pr-2">{t('summaryTotal')}</td>
                  <td className="py-1 pr-2 text-right font-mono">{summary.charged.toFixed(2)}</td>
                  <td className="py-1 pr-2 text-right font-mono">{summary.paid.toFixed(2)}</td>
                  <td className="py-1 text-right font-mono">{summary.debt.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          <CatalogField
            kind="OPS_HOT"
            label={t('guestSettlement')}
            value={guestMode}
            onChange={(v) => setGuestMode(String(v) === 'DEBT' ? 'DEBT' : 'PAY')}
            options={[
              { value: 'PAY', label: t('payGuestFirst') },
              { value: 'DEBT', label: t('guestDebt') },
            ]}
            emptyLabel={null}
          />
          <CatalogField
            kind="OPS_HOT"
            label={t('checkoutMode')}
            value={transferToCl ? 'CL' : 'KEEP'}
            onChange={(v) => setTransferToCl(String(v) === 'CL')}
            options={[
              { value: 'KEEP', label: t('keepAgencyOpen') },
              { value: 'CL', label: t('leaveOnCityLedger') },
            ]}
            emptyLabel={null}
          />
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {guestMode === 'DEBT' ? t('guestDebtHint') : t('payGuestFirstHint')}
            {transferToCl ? ` ${t('leaveOnCityLedgerHint')}` : ''}
          </p>
          {guestMode === 'DEBT' && balance > 0.01 ? (
            <FieldTextarea
              label={t('guestDebtNote')}
              value={guestDebtNote}
              onChange={(e) => setGuestDebtNote(e.target.value)}
            />
          ) : null}
          {guestMode === 'PAY' && balance > 0.01 && guest ? (
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <CatalogField
                    kind="CLOSED_SMALL"
                    label={t('method')}
                    value={line.method}
                    onChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx]!, method: String(v ?? 'CASH') };
                      setLines(next);
                    }}
                    options={TENDERS.map((m) => ({ value: m, label: tPay(m) }))}
                    emptyLabel={null}
                  />
                  <Field
                    label={tc('amount')}
                    preset="amount"
                    type="number"
                    value={line.amount}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx]!, amount: e.target.value };
                      setLines(next);
                    }}
                  />
                  {line.method === 'CARD' ? (
                    bankTerminals.length > 0 ? (
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t('bankTerminal')}
                      value={line.bankTerminalId}
                      onChange={(v) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx]!, bankTerminalId: String(v ?? '') };
                        setLines(next);
                      }}
                      options={terminalOptions}
                      emptyLabel={null}
                    />
                    ) : (
                      <p className="m-0 text-[12px] text-amber-800">{t('noBankTerminal')}</p>
                    )
                  ) : null}
                  {line.method === 'BANK_TRANSFER' ? (
                    <Field
                      label={t('bankReference')}
                      preset="longText"
                      value={line.bankReference}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx]!, bankReference: e.target.value };
                        setLines(next);
                      }}
                    />
                  ) : null}
                </div>
              ))}
              <Field
                label={t('discountAzn')}
                preset="amount"
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <label className="inline-flex items-center gap-1.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={applyDeposits}
                  onChange={(e) => setApplyDeposits(e.target.checked)}
                />
                {t('applyHeldDeposits')}
                {heldDeposits > 0 ? ` (${heldDeposits.toFixed(2)} AZN)` : ''}
              </label>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setLines((prev) => [
                    {
                      method: prev[0]?.method ?? 'CASH',
                      amount: balance > 0 ? balance.toFixed(2) : '',
                      bankReference: prev[0]?.bankReference ?? '',
                      bankTerminalId: prev[0]?.bankTerminalId ?? '',
                    },
                  ])
                }
              >
                {t('payAll')}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setLines([...lines, { method: 'CASH', amount: '', bankReference: '', bankTerminalId: '' }])
                }
              >
                {t('addTenderLine')}
              </button>
            </div>
          ) : null}
          {early?.applicable ? (
            <div className="space-y-1 rounded border border-[#D5DADF] bg-[#F8FAFC] p-3">
              <p className="m-0 font-medium">{t('earlyCheckoutTitle')}</p>
              <p className="m-0">{t('earlyCheckoutNights', { count: early.unusedNights })}</p>
              <p className="m-0">{t('earlyCheckoutGross', { amount: early.unusedSellGross.toFixed(2) })}</p>
              <p className="m-0">{t('earlyCheckoutVat', { amount: early.vatWithheld.toFixed(2) })}</p>
              <p className="m-0">{t('earlyCheckoutCash', { amount: early.guestCashRefund.toFixed(2) })}</p>
              {early.guestCashRefund > 0 ? (
                <>
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('earlyCheckoutTender')}
                    value={refundMethod}
                    onChange={(v) => setRefundMethod(String(v ?? 'CASH'))}
                    options={[
                      { value: 'CASH', label: tPay('CASH') },
                      { value: 'CARD', label: tPay('CARD') },
                    ]}
                    emptyLabel={null}
                  />
                  {refundMethod === 'CARD' && bankTerminals.length > 0 ? (
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t('bankTerminal')}
                      value={refundTerminal}
                      onChange={(v) => setRefundTerminal(String(v ?? ''))}
                      options={terminalOptions}
                      emptyLabel={null}
                    />
                  ) : null}
                  <Field
                    label={t('earlyCheckoutReason')}
                    preset="shortText"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </>
              ) : null}
            </div>
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
            onSubmit={() => {
              if (!remainder) return;
              if (remainderMethod === 'CARD' && !remainderTerminal.trim()) {
                showApiError({ error: t('bankTerminal') }, tc('error'));
                return;
              }
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
                      bankTerminalId:
                        remainderMethod === 'CARD' ? remainderTerminal.trim() || undefined : undefined,
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
          <p className="m-0 text-[13px]">{t('depositRemainderHint', { amount: (remainder?.amount ?? 0).toFixed(2) })}</p>
          <CatalogField
            kind="OPS_HOT"
            label={t('method')}
            value={remainderMethod}
            onChange={(v) => setRemainderMethod(String(v ?? 'CASH'))}
            options={[
              { value: 'CASH', label: tPay('CASH') },
              { value: 'CARD', label: tPay('CARD') },
            ]}
            emptyLabel={null}
          />
          {remainderMethod === 'CARD' && bankTerminals.length > 0 ? (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('bankTerminal')}
              value={remainderTerminal}
              onChange={(v) => setRemainderTerminal(String(v ?? ''))}
              options={terminalOptions}
              emptyLabel={null}
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
