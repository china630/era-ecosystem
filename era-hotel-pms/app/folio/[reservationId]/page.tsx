'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
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
  PENDING: 'text-amber-300',
  SENT: 'text-sky-300',
  ACCEPTED: 'text-emerald-300',
  REJECTED: 'text-rose-300',
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
        paymentMethod: 'CASH',
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('paymentRecorded') : data.error);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <Link href="/" className="text-sm text-sky-400 hover:underline">
        {t('backChessboard')}
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold">
        {t('title', { id: reservationId.slice(0, 8) })}
      </h1>

      <p
        className={`mb-4 rounded-lg px-4 py-2 text-sm ${Math.abs(totalBalance) < 0.01 ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200'}`}
      >
        {t('totalBalance')} <strong>{totalBalance.toFixed(2)} AZN</strong>
        {Math.abs(totalBalance) < 0.01 ? t('readyCheckout') : t('paymentRequired')}
      </p>

      {folios.map((f) => (
        <div key={f.id} className="mb-4 rounded-xl border border-slate-700 p-4">
          <h2 className="font-medium">
            {t('folioLine', {
              type: f.type,
              status: f.status,
              balance: folioBalance(f).toFixed(2),
            })}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
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
                  <button
                    type="button"
                    onClick={() => voidCharge(c.id)}
                    className="text-xs text-rose-400 hover:underline"
                  >
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
            <button
              type="button"
              onClick={() => issueInvoice(f.id)}
              className="mt-2 rounded bg-indigo-800 px-2 py-1 text-xs"
            >
              {t('issueInvoice')}
            </button>
          )}
          {(f.fiscalDocuments?.length ?? 0) > 0 && (
            <div className="mt-3 rounded border border-slate-600 bg-slate-900/50 p-2 text-xs">
              <p className="font-medium text-slate-400">{t('fiscalTitle')}</p>
              {f.fiscalDocuments!.map((d) => (
                <p key={d.id} className={FISCAL_COLORS[d.fiscalStatus] ?? 'text-slate-300'}>
                  {d.invoiceNumber ?? d.id.slice(0, 8)} —{' '}
                  {tFiscal(d.fiscalStatus as 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED')}
                  {d.fiscalExternalId ? ` (${d.fiscalExternalId})` : ''}
                  {d.rejectionReason ? ` — ${d.rejectionReason}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}

      {can(PERMISSIONS.FOLIO_CHARGE) && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="number"
            className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
          />
          <button
            type="button"
            onClick={addCharge}
            className="rounded bg-slate-600 px-3 py-1 text-sm hover:bg-slate-500"
          >
            {t('postCharge')}
          </button>
        </div>
      )}

      {can(PERMISSIONS.FOLIO_PAYMENT) && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
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
            className="w-28 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <button
            type="button"
            onClick={addPayment}
            className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600"
          >
            {t('recordPayment')}
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-slate-300">{msg}</p>}
    </div>
  );
}
