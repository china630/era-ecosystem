'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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
    amount: number;
    paymentMethod: string;
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
  const p = f.payments.reduce((s, x) => s + Number(x.amount), 0);
  return c - p;
}

export default function FolioPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;
  const { can } = useAuth();
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tChess = useTranslations('chessboard');
  const tFiscal = useTranslations('fiscalStatus');
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<{ id: string; code: string }[]>([]);
  const [selectedFolio, setSelectedFolio] = useState('');
  const [chargeAmount, setChargeAmount] = useState('25');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  const [settleLines, setSettleLines] = useState<{ method: string; amount: string }[]>([
    { method: 'CASH', amount: '' },
  ]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [fRes, rRes] = await Promise.all([
      fetch(`/api/folios?reservationId=${reservationId}`),
      fetch('/api/master/revenue-codes'),
    ]);
    const fData = await fRes.json();
    const rData = await rRes.json();
    if (fRes.ok) {
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
  }, [reservationId]);

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
    setMsg(res.ok ? t('chargePosted') : data.error);
    await load();
  }

  async function voidCharge(chargeId: string) {
    const res = await fetch(`/api/folios/charges/${chargeId}/void`, { method: 'POST' });
    const data = await res.json();
    setMsg(res.ok ? t('chargeVoided') : data.error);
    await load();
  }

  async function issueInvoice(folioId: string) {
    const res = await fetch(`/api/folios/${folioId}/issue-invoice`, { method: 'POST' });
    const data = await res.json();
    setMsg(res.ok ? t('invoiceIssued', { number: data.invoiceNumber }) : data.error);
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
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('paymentRecorded') : data.error);
    await load();
  }

  async function completeSettlement() {
    if (!selectedFolio) return;
    const lines = settleLines
      .map((l) => ({ method: l.method, amount: parseFloat(l.amount) }))
      .filter((l) => l.amount > 0);
    if (lines.length === 0) return;
    const res = await fetch('/api/folios/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folioId: selectedFolio, lines }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Settlement completed' : data.error);
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
    setMsg(res.ok ? 'Deposit recorded (HELD)' : data.error);
    await load();
  }

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader
        title={t('title', { id: reservationId.slice(0, 8) })}
        leading={
          <Link href="/" className="text-[13px] text-[#2980B9] hover:underline">
            {t('backChessboard')}
          </Link>
        }
      />

      <PageSection
        className={`mb-4 text-[13px] ${
          Math.abs(totalBalance) < 0.01
            ? 'border-[#2980B9]/30 bg-[#F8FAFC] text-[#34495E]'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {t('totalBalance')} <strong>{totalBalance.toFixed(2)} AZN</strong>
        {Math.abs(totalBalance) < 0.01 ? t('readyCheckout') : t('paymentRequired')}
      </PageSection>

      <StatusMessage>{msg}</StatusMessage>

      {folios.map((f) => (
        <PageSection key={f.id} className="mb-4">
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
              </li>
            ))}
            {f.payments.map((p, i) => (
              <li key={i}>
                {t('paymentLine', { method: p.paymentMethod, amount: Number(p.amount) })}
                {p.fiscalReceiptId ? t('kkmReceipt', { receiptId: p.fiscalReceiptId }) : ''}
              </li>
            ))}
          </ul>
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
        </PageSection>
      ))}

      {can(PERMISSIONS.FOLIO_CHARGE) && (
        <PageSection className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="number"
            className={`w-24 ${MODAL_INPUT_CLASS}`}
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
          />
          <button type="button" onClick={addCharge} className={SECONDARY_BUTTON_CLASS}>
            {t('postCharge')}
          </button>
        </PageSection>
      )}

      {can(PERMISSIONS.FOLIO_PAYMENT) && (
        <PageSection className="flex flex-wrap items-center gap-2">
          <select
            className={MODAL_INPUT_CLASS}
            value={selectedFolio}
            onChange={(e) => setSelectedFolio(e.target.value)}
          >
            {folios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.type}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={tc('amount')}
            className={`w-28 ${MODAL_INPUT_CLASS}`}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <select
            className={MODAL_INPUT_CLASS}
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="LOYALTY_POINTS">LOYALTY_POINTS</option>
            <option value="COMPANY_ACCOUNT">COMPANY_ACCOUNT</option>
          </select>
          <button type="button" onClick={addPayment} className={PRIMARY_BUTTON_CLASS}>
            {t('recordPayment')}
          </button>
          <button type="button" onClick={recordDeposit} className={SECONDARY_BUTTON_CLASS}>
            Record deposit (HELD)
          </button>
        </PageSection>
      )}

      {can(PERMISSIONS.FOLIO_PAYMENT) && totalBalance > 0.01 && (
        <PageSection className="mt-4 space-y-2">
          <h3 className="font-semibold text-[#34495E]">Split settlement</h3>
          {loyaltyBalance != null && loyaltyBalance > 0 && (
            <p className="text-[13px] text-[#7F8C8D]">Loyalty redeemable: up to {loyaltyBalance.toFixed(2)} AZN</p>
          )}
          {settleLines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap gap-2">
              <select
                className={MODAL_INPUT_CLASS}
                value={line.method}
                onChange={(e) => {
                  const next = [...settleLines];
                  next[idx] = { ...next[idx], method: e.target.value };
                  setSettleLines(next);
                }}
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="LOYALTY_POINTS">LOYALTY_POINTS</option>
              </select>
              <input
                type="number"
                className={`w-28 ${MODAL_INPUT_CLASS}`}
                placeholder="Amount"
                value={line.amount}
                onChange={(e) => {
                  const next = [...settleLines];
                  next[idx] = { ...next[idx], amount: e.target.value };
                  setSettleLines(next);
                }}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setSettleLines([...settleLines, { method: 'CASH', amount: '' }])}
            >
              Add tender line
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={completeSettlement}>
              Complete settlement
            </button>
          </div>
        </PageSection>
      )}
    </AppShell>
  );
}
