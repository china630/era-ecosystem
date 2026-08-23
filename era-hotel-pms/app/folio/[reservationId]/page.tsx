'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldSelect,
  FieldTextarea,
  FxEquivalentBadge,
  GHOST_BUTTON_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface FiscalDoc {
  id: string;
  invoiceNumber: string | null;
  fiscalStatus: string;
  fiscalExternalId: string | null;
  rejectionReason: string | null;
}

interface FolioRow {
  id: string;
  type: string;
  status: string;
  charges: { id: string; amount: number; qty: number; description: string; revenueCode: { code: string } }[];
  payments: {
    id?: string;
    amount: number;
    paymentMethod: string;
    kind?: string;
    fiscalReceiptId?: string | null;
    fiscalQrPayload?: string | null;
  }[];
  fiscalDocuments?: FiscalDoc[];
}

const FISCAL_COLORS: Record<string, string> = {
  PENDING: 'text-amber-700',
  SENT: 'text-[#2980B9]',
  ACCEPTED: 'text-[#2980B9]',
  REJECTED: 'text-rose-600',
};

function folioBalance(f: FolioRow): number {
  const c = f.charges.reduce((s, x) => s + Number(x.amount) * x.qty, 0);
  const p = f.payments.reduce((s, x) => {
    const n = Number(x.amount);
    return s + (x.kind === 'REFUND' ? -n : n);
  }, 0);
  return c - p;
}

export default function FolioPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;
  const { can } = useAuth();
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tHk = useTranslations('housekeeping');
  const tChess = useTranslations('chessboard');
  const tFiscal = useTranslations('fiscalStatus');
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<{ id: string; code: string }[]>([]);
  const [selectedFolio, setSelectedFolio] = useState('');
  const [chargeAmount, setChargeAmount] = useState('25');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payBankReference, setPayBankReference] = useState('');
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  const [settleLines, setSettleLines] = useState<
    { method: string; amount: string; bankReference: string }[]
  >([{ method: 'CASH', amount: '', bankReference: '' }]);
  const [pricingCurrency, setPricingCurrency] = useState('AZN');
  const [applyDeposits, setApplyDeposits] = useState(true);
  const [discountAmount, setDiscountAmount] = useState('');
  const [transferToCl, setTransferToCl] = useState(true);
  const [heldDeposits, setHeldDeposits] = useState(0);
  const [refundTarget, setRefundTarget] = useState<{ id: string; max: number; folioStatus: string } | null>(
    null,
  );
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [earlyCheckout, setEarlyCheckout] = useState<{
    applicable: boolean;
    unusedNights: number;
    unusedSellGross: number;
    vatWithheld: number;
    refundNet: number;
    guestCashRefund: number;
  } | null>(null);
  const [unusedNightsRefundMethod, setUnusedNightsRefundMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [unusedNightsReason, setUnusedNightsReason] = useState('');
  const [laundryOpenTickets, setLaundryOpenTickets] = useState<Array<{ id: string; guestName: string }>>([]);
  const [laundryScan, setLaundryScan] = useState('');

  async function openCheckoutConfirm() {
    setUnusedNightsRefundMethod('CASH');
    setUnusedNightsReason('');
    setEarlyCheckout(null);
    setCheckoutConfirmOpen(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/early-checkout-preview`);
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && payload) {
        setEarlyCheckout({
          applicable: !!payload.applicable,
          unusedNights: Number(payload.unusedNights) || 0,
          unusedSellGross: Number(payload.unusedSellGross) || 0,
          vatWithheld: Number(payload.vatWithheld) || 0,
          refundNet: Number(payload.refundNet) || 0,
          guestCashRefund: Number(payload.guestCashRefund) || 0,
        });
      }
    } catch {
      /* preview optional */
    }
  }

  const load = useCallback(async () => {
    const [fRes, rRes, resRes] = await Promise.all([
      fetch(`/api/folios?reservationId=${reservationId}`),
      fetch('/api/master/revenue-codes'),
      fetch(`/api/reservations/${reservationId}`),
    ]);
    const fData = await fRes.json();
    const rData = await rRes.json();
    const resData = resRes.ok ? await resRes.json() : null;
    if (!fRes.ok) {
      showApiError(fData, tc('loadError'));
    } else {
      setFolios(fData);
      if (fData[0]) setSelectedFolio(fData[0].id);
      const guestPhone = fData[0]?.reservation?.guest?.phone as string | undefined;
      if (guestPhone) {
        const lb = await fetch(`/api/loyalty/balance?customerRef=${encodeURIComponent(guestPhone)}`);
        if (lb.ok) {
          const b = await lb.json();
          setLoyaltyBalance(b.maxRedeemableAzn ?? 0);
        }
      }
    }
    if (rRes.ok) setRevenueCodes(rData);
    const rates = (resData?.dailyRates as Array<{ currencyCode?: string }> | undefined) ?? [];
    const foreign = rates
      .map((d) => (d.currencyCode ?? 'AZN').trim().toUpperCase())
      .find((c) => c !== 'AZN');
    setPricingCurrency(foreign ?? rates[0]?.currencyCode?.trim().toUpperCase() ?? 'AZN');
  }, [reservationId, tc]);

  useEffect(() => {
    if (!selectedFolio) return;
    void fetch(`/api/folios/settle?folioId=${selectedFolio}`)
      .then((r) => r.json())
      .then((p) => {
        if (p?.heldDeposits != null) setHeldDeposits(Number(p.heldDeposits));
      })
      .catch(() => null);
  }, [selectedFolio, folios]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBalance = folios.reduce((s, f) => s + folioBalance(f), 0);

  async function addCharge() {
    const food = revenueCodes.find((r) => r.code === 'FOOD') ?? revenueCodes[0];
    if (!food) return;
    const res = await fetch('/api/folios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        revenueCodeId: food.id,
        amount: parseFloat(chargeAmount),
        qty: 1,
        description: tChess('quickPosting'),
      }),
    });
    const data = await res.json();
    if (res.ok) showSuccess(t('chargePosted'));
    else showApiError(data, tc('error'));
    await load();
  }

  async function voidCharge(chargeId: string) {
    const res = await fetch(`/api/folios/charges/${chargeId}/void`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) showSuccess(t('chargeVoided'));
    else showApiError(data, tc('error'));
    await load();
  }

  async function payChargeLine(chargeId: string) {
    const res = await fetch(`/api/folios/charges/${chargeId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: payMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : payMethod }),
    });
    const data = await res.json();
    if (res.ok) showSuccess(t('pay'));
    else showApiError(data, tc('error'));
    await load();
  }

  async function issueInvoice(folioId: string) {
    const res = await fetch(`/api/folios/${folioId}/issue-invoice`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) showSuccess(t('invoiceIssued', { number: data.invoiceNumber }));
    else showApiError(data, tc('error'));
    await load();
  }

  async function addPayment() {
    if (!selectedFolio) return;
    const res = await fetch('/api/folios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folioId: selectedFolio,
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        bankReference:
          payMethod === 'BANK_TRANSFER' && payBankReference.trim()
            ? payBankReference.trim()
            : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showSuccess(t('paymentRecorded'));
      setPayBankReference('');
    } else showApiError(data, tc('error'));
    await load();
  }

  async function completeSettlement() {
    if (!selectedFolio) return;
    const lines = settleLines
      .map((l) => ({
        method: l.method,
        amount: parseFloat(l.amount),
        bankReference:
          l.method === 'BANK_TRANSFER' && l.bankReference.trim()
            ? l.bankReference.trim()
            : undefined,
      }))
      .filter((l) => l.amount > 0);
    if (lines.length === 0 && !applyDeposits) return;
    if (lines.length === 0 && applyDeposits) {
      lines.push({
        method: 'DEPOSIT',
        amount: Math.max(heldDeposits, 0.01),
        bankReference: undefined,
      });
    }
    const res = await fetch('/api/folios/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folioId: selectedFolio,
        lines,
        applyDeposits,
        discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) showSuccess(t('settlementCompleted'));
    else showApiError(data, tc('error'));
    await load();
  }

  async function refundPayment() {
    if (!refundTarget) return;
    if (refundTarget.folioStatus === 'TRANSFERRED_AR') {
      showApiError({ error: t('refundBlockedTransferred') }, tc('error'));
      return;
    }
    const amount = refundAmount ? parseFloat(refundAmount) : undefined;
    const res = await fetch(`/api/folios/payments/${refundTarget.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount && amount > 0 ? amount : undefined,
        reason: refundReason.trim() || t('refundDefaultReason'),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showSuccess(t('refundSuccess'));
      setRefundTarget(null);
      setRefundAmount('');
      setRefundReason('');
    } else showApiError(data, tc('error'));
    await load();
  }

  async function closeOneFolio(folioId: string) {
    const res = await fetch(`/api/folios/${folioId}/close`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) showSuccess(t('folioClosed'));
    else showApiError(data, tc('error'));
    await load();
  }

  async function doCheckout() {
    const res = await fetch(`/api/reservations/${reservationId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferToCityLedger: transferToCl,
        discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
        unusedNightsRefundMethod:
          earlyCheckout?.applicable && earlyCheckout.guestCashRefund > 0
            ? unusedNightsRefundMethod
            : undefined,
        unusedNightsReason:
          earlyCheckout?.applicable && unusedNightsReason.trim()
            ? unusedNightsReason.trim()
            : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showSuccess(
        data.cityLedgerTransferred?.length
          ? t('checkoutClSuccess', { count: data.cityLedgerTransferred.length })
          : t('checkoutSuccess'),
      );
      setCheckoutConfirmOpen(false);
    } else if (data.code === 'LAUNDRY_OPEN' && Array.isArray(data.tickets)) {
      setLaundryOpenTickets(data.tickets);
      setCheckoutConfirmOpen(false);
    } else showApiError(data, tc('error'));
    await load();
  }

  async function recordDeposit() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    const res = await fetch(`/api/reservations/${reservationId}/deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paymentMethod: payMethod }),
    });
    const data = await res.json();
    if (res.ok) showSuccess(t('depositRecorded'));
    else showApiError(data, tc('error'));
    await load();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t('title', { id: reservationId.slice(0, 8) })}
        leading={
          <Link href="/" className="text-[13px] text-[#2980B9] hover:underline">
            {t('backChessboard')}
          </Link>
        }
      />

      <section
        className={`${CARD_CONTAINER_CLASS} mb-4 p-4 text-[13px] ${
          Math.abs(totalBalance) < 0.01
            ? 'border-[#2980B9]/30 bg-[#F8FAFC] text-[#34495E]'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {t('totalBalance')} <strong>{totalBalance.toFixed(2)} AZN</strong>
        {pricingCurrency !== 'AZN' ? (
          <span className="ml-2 inline-block">
            ({t('ratesIn', { currency: pricingCurrency })}{' '}
            <FxEquivalentBadge amount={Math.abs(totalBalance)} currencyCode="AZN" to={pricingCurrency} label="≈" />)
          </span>
        ) : null}
        {Math.abs(totalBalance) < 0.01 ? t('readyCheckout') : t('paymentRequired')}
        {heldDeposits > 0 ? (
          <span className="ml-2">
            · {t('heldDeposits', { amount: heldDeposits.toFixed(2) })}
          </span>
        ) : null}
        {can(PERMISSIONS.RESERVATIONS_CHECKOUT) ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="m-0 text-[12px] font-medium text-[#34495E]">{t('checkoutMode')}</p>
              <label className="mr-3 inline-flex items-center gap-1.5 text-[12px]">
                <input
                  type="radio"
                  name="clMode"
                  checked={transferToCl}
                  onChange={() => setTransferToCl(true)}
                />
                {t('leaveOnCityLedger')}
              </label>
              <label className="inline-flex items-center gap-1.5 text-[12px]">
                <input
                  type="radio"
                  name="clMode"
                  checked={!transferToCl}
                  onChange={() => setTransferToCl(false)}
                />
                {t('payGuestFirst')}
              </label>
              <p className="m-0 text-[11px] text-[#7F8C8D]">
                {transferToCl ? t('leaveOnCityLedgerHint') : t('payGuestFirstHint')}
              </p>
            </div>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void openCheckoutConfirm()}
            >
              {t('checkOut')}
            </button>
          </div>
        ) : null}
      </section>

      {folios.map((f) => (
        <section key={f.id} className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
          <h2 className="font-semibold text-[#34495E]">
            {t('folioLine', {
              type: f.type,
              status: f.status,
              balance: folioBalance(f).toFixed(2),
            })}
          </h2>
          <ul className="mt-2 space-y-1 text-[13px] text-[#7F8C8D]">
            {f.charges.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t('chargeLine', {
                    description: c.description,
                    code: c.revenueCode.code,
                    amount: Number(c.amount) * c.qty,
                  })}
                </span>
                {can(PERMISSIONS.FOLIO_VOID) && (
                  <button type="button" onClick={() => voidCharge(c.id)} className={GHOST_BUTTON_CLASS}>
                    {t('void')}
                  </button>
                )}
                {can(PERMISSIONS.FOLIO_PAYMENT) && f.type === 'GUEST' && f.status === 'OPEN' && (
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    onClick={() => void payChargeLine(c.id)}
                  >
                    {t('pay')}
                  </button>
                )}
              </li>
            ))}
            {f.payments.map((p, i) => (
              <li key={p.id ?? i} className="flex flex-wrap items-center gap-2">
                <span>
                  {p.kind === 'REFUND' ? 'REFUND ' : ''}
                  {t('paymentLine', { method: p.paymentMethod, amount: Number(p.amount) })}
                  {p.fiscalReceiptId ? t('kkmReceipt', { receiptId: p.fiscalReceiptId }) : ''}
                </span>
                {can(PERMISSIONS.FOLIO_PAYMENT) && p.id && p.kind !== 'REFUND' ? (
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    disabled={f.status === 'TRANSFERRED_AR'}
                    title={
                      f.status === 'TRANSFERRED_AR' ? t('refundBlockedTransferred') : undefined
                    }
                    onClick={() => {
                      if (f.status === 'TRANSFERRED_AR') {
                        showApiError({ error: t('refundBlockedTransferred') }, tc('error'));
                        return;
                      }
                      setRefundTarget({
                        id: p.id!,
                        max: Number(p.amount),
                        folioStatus: f.status,
                      });
                      setRefundAmount(String(p.amount));
                      setRefundReason('');
                    }}
                  >
                    {t('refund')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {can(PERMISSIONS.FOLIO_PAYMENT) && f.status === 'OPEN' && Math.abs(folioBalance(f)) < 0.01 ? (
            <button
              type="button"
              onClick={() => void closeOneFolio(f.id)}
              className={`mt-2 mr-2 ${SECONDARY_BUTTON_CLASS}`}
            >
              {t('closeFolio')}
            </button>
          ) : null}
          {can(PERMISSIONS.FOLIO_PAYMENT) && f.charges.length > 0 && (
            <button type="button" onClick={() => issueInvoice(f.id)} className={`mt-2 ${SECONDARY_BUTTON_CLASS}`}>
              {t('issueInvoice')}
            </button>
          )}
          {(f.fiscalDocuments?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-2 text-[13px]">
              <p className="font-semibold text-[#34495E]">{t('fiscalTitle')}</p>
              {f.fiscalDocuments!.map((d) => (
                <p key={d.id} className={FISCAL_COLORS[d.fiscalStatus] ?? 'text-[#34495E]'}>
                  {d.invoiceNumber ?? d.id.slice(0, 8)} —{' '}
                  {tFiscal(d.fiscalStatus as 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED')}
                  {(d as { eqaimeId?: string; eqaimeStatus?: string }).eqaimeId
                    ? ` · e-qaimə ${(d as { eqaimeStatus?: string }).eqaimeStatus ?? 'PENDING'}`
                    : ''}
                  {d.fiscalExternalId ? ` (${d.fiscalExternalId})` : ''}
                  {d.rejectionReason ? ` — ${d.rejectionReason}` : ''}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {can(PERMISSIONS.FOLIO_CHARGE) && (
        <section className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-2 p-4`}>
          <Field
            label={tc('amount')}
            preset="amount"
            type="number"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
          />
          <button type="button" onClick={addCharge} className={SECONDARY_BUTTON_CLASS}>
            {t('postCharge')}
          </button>
        </section>
      )}

      {can(PERMISSIONS.FOLIO_PAYMENT) && (
        <section className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-2 p-4`}>
          <FieldSelect
            label="Folio"
            preset="select"
            value={selectedFolio}
            onChange={(e) => setSelectedFolio(e.target.value)}
          >
            {folios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.type}
              </option>
            ))}
          </FieldSelect>
          <Field
            label={tc('amount')}
            preset="amount"
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <FieldSelect
            label="Method"
            preset="select"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="LOYALTY_POINTS">LOYALTY_POINTS</option>
            <option value="COMPANY_ACCOUNT">COMPANY_ACCOUNT</option>
          </FieldSelect>
          {payMethod === 'BANK_TRANSFER' && (
            <Field
              label={t('bankReference')}
              preset="longText"
              value={payBankReference}
              onChange={(e) => setPayBankReference(e.target.value)}
              placeholder={t('bankReferencePlaceholder')}
            />
          )}
          <button type="button" onClick={addPayment} className={PRIMARY_BUTTON_CLASS}>
            {t('recordPayment')}
          </button>
          <button type="button" onClick={recordDeposit} className={SECONDARY_BUTTON_CLASS}>
            {t('recordDeposit')}
          </button>
        </section>
      )}

      {can(PERMISSIONS.FOLIO_PAYMENT) && totalBalance > 0.01 && (
        <section className={`${CARD_CONTAINER_CLASS} mt-4 space-y-2 p-4`}>
          <h3 className="font-semibold text-[#34495E]">{t('settleTitle')}</h3>
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('settleHint')}</p>
          {loyaltyBalance != null && loyaltyBalance > 0 && (
            <p className="text-[13px] text-[#7F8C8D]">
              {t('loyaltyRedeemable', { amount: loyaltyBalance.toFixed(2) })}
            </p>
          )}
          {settleLines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <FieldSelect
                label={t('method')}
                preset="select"
                value={line.method}
                onChange={(e) => {
                  const next = [...settleLines];
                  next[idx] = { ...next[idx], method: e.target.value };
                  setSettleLines(next);
                }}
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="LOYALTY_POINTS">LOYALTY_POINTS</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="COMPANY_ACCOUNT">COMPANY_ACCOUNT</option>
              </FieldSelect>
              <Field
                label={tc('amount')}
                preset="amount"
                type="number"
                value={line.amount}
                onChange={(e) => {
                  const next = [...settleLines];
                  next[idx] = { ...next[idx], amount: e.target.value };
                  setSettleLines(next);
                }}
              />
              {line.method === 'BANK_TRANSFER' && (
                <Field
                  label={t('bankReference')}
                  preset="longText"
                  value={line.bankReference}
                  onChange={(e) => {
                    const next = [...settleLines];
                    next[idx] = { ...next[idx], bankReference: e.target.value };
                    setSettleLines(next);
                  }}
                  placeholder={t('bankReferencePlaceholder')}
                />
              )}
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
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() =>
                setSettleLines([...settleLines, { method: 'CASH', amount: '', bankReference: '' }])
              }
            >
              {t('addTenderLine')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={completeSettlement}>
              {t('completeSettlement')}
            </button>
          </div>
        </section>
      )}

      <EraModal
        open={Boolean(refundTarget)}
        title={t('refundModalTitle')}
        onClose={() => setRefundTarget(null)}
        footer={
          <EraModalFooter
            onCancel={() => setRefundTarget(null)}
            onSubmit={() => void refundPayment()}
            submitLabel={t('refund')}
          />
        }
      >
        <div className="space-y-3">
          <p className="m-0 text-[13px] text-[#7F8C8D]">
            {t('refundModalHint', { max: refundTarget?.max.toFixed(2) ?? '0' })}
          </p>
          <Field
            label={tc('amount')}
            preset="amount"
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
          <FieldTextarea
            label={t('refundReason')}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
          />
        </div>
      </EraModal>

      <EraModal
        open={checkoutConfirmOpen}
        title={t('checkOut')}
        onClose={() => setCheckoutConfirmOpen(false)}
        footer={
          <EraModalFooter
            onCancel={() => setCheckoutConfirmOpen(false)}
            onSubmit={() => void doCheckout()}
            submitLabel={t('confirmCheckout')}
          />
        }
      >
        <div className="space-y-2 text-[13px] text-[#34495E]">
          <p className="m-0">
            {t('totalBalance')} <strong>{totalBalance.toFixed(2)} AZN</strong>
          </p>
          <p className="m-0 text-[#7F8C8D]">
            {transferToCl ? t('leaveOnCityLedgerHint') : t('payGuestFirstHint')}
          </p>
          {transferToCl ? (
            <p className="m-0 text-amber-800">{t('checkoutClConfirmWarn')}</p>
          ) : null}
          {earlyCheckout?.applicable ? (
            <div className="mt-2 space-y-2 rounded border border-[#BDC3C7] bg-[#F8F9F9] p-3">
              <p className="m-0 font-medium">{t('earlyCheckoutTitle')}</p>
              <p className="m-0">
                {t('earlyCheckoutNights', { count: earlyCheckout.unusedNights })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutGross', { amount: earlyCheckout.unusedSellGross.toFixed(2) })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutVat', { amount: earlyCheckout.vatWithheld.toFixed(2) })}
              </p>
              <p className="m-0">
                {t('earlyCheckoutCash', { amount: earlyCheckout.guestCashRefund.toFixed(2) })}
              </p>
              {earlyCheckout.guestCashRefund > 0 ? (
                <>
                  <FieldSelect
                    label={t('earlyCheckoutTender')}
                    preset="select"
                    value={unusedNightsRefundMethod}
                    onChange={(e) =>
                      setUnusedNightsRefundMethod(e.target.value as 'CASH' | 'CARD')
                    }
                  >
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                  </FieldSelect>
                  <Field
                    label={t('earlyCheckoutReason')}
                    preset="shortText"
                    value={unusedNightsReason}
                    onChange={(e) => setUnusedNightsReason(e.target.value)}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </EraModal>
      <EraModal
        open={laundryOpenTickets.length > 0}
        title={tHk('laundryOpenCheckout')}
        onClose={() => setLaundryOpenTickets([])}
      >
        <ul className="mb-3 text-[13px]">
          {laundryOpenTickets.map((tk) => (
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
          onCancel={() => setLaundryOpenTickets([])}
          cancelLabel={tHk('waitLaundry')}
          onSubmit={async () => {
            const first = laundryOpenTickets[0];
            if (!first || !laundryScan) {
              showApiError({ error: tHk('returnScanRequired') }, tc('error'));
              return;
            }
            const res = await fetch('/api/housekeeping/laundry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deliverTicketId: first.id,
                returnScanKey: laundryScan,
                actorRole: 'FO',
              }),
            });
            if (!res.ok) showApiError(await res.json(), tc('error'));
            else {
              showSuccess(tc('saved'));
              setLaundryOpenTickets([]);
              await load();
            }
          }}
          submitLabel={tHk('deliverLaundry')}
        />
      </EraModal>
    </div>
  );
}
