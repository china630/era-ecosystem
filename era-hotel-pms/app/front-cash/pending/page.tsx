'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parsePendingReceiptLines } from '@/lib/pending-receipt-lines';
import { collapsePendingBaskets, type BasketGridRow } from '@/lib/pending-baskets';

type PendingRow = {
  id: string;
  sourceSystem: string;
  sourceRef: string;
  amount: string | number;
  currency: string;
  sku: string | null;
  qty: number;
  description: string;
  payerLabel: string | null;
  revenueCode?: string | null;
  createdAt: string;
  businessDate: string;
  basketRef?: string | null;
};

type GridRow = BasketGridRow<PendingRow>;

export default function FrontCashPendingPage() {
  const { can } = useAuth();
  const t = useTranslations('frontCashPending');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<GridRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlement/pending?status=PENDING');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(method: 'CASH' | 'CARD') {
    if (!receipt) return;
    setBusy(true);
    const basket = Boolean(receipt.basketRef) && receipt.basketCount > 1;
    try {
      const res = await fetch(
        basket
          ? '/api/settlement/pending/basket/pay'
          : `/api/settlement/pending/${receipt.members[0]?.id ?? receipt.id}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            basket
              ? { basketRef: receipt.basketRef, paymentMethod: method }
              : { paymentMethod: method },
          ),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Money may already be PAID on the server (legacy 500 after callback fail) — refresh list.
        const msg = typeof data?.error === 'string' ? data.error : '';
        if (/paid,\s*but/i.test(msg)) {
          setReceipt(null);
          showApiError(data, t('payFailed'));
          void load();
          return;
        }
        showApiError(data, t('payFailed'));
        return;
      }
      setReceipt(null);
      if (typeof data?.warning === 'string' && data.warning.trim()) {
        showApiError({ error: data.warning }, t('payFailed'));
      } else {
        showSuccess(t('paySuccess'));
      }
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function voidPending() {
    if (!receipt || voidReason.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settlement/pending/${receipt.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('voidFailed'));
        return;
      }
      setVoidOpen(false);
      setVoidReason('');
      setReceipt(null);
      showSuccess(t('voidSuccess'));
      void load();
    } finally {
      setBusy(false);
    }
  }

  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const canVoid = can(PERMISSIONS.FOLIO_VOID);
  const collapsed = useMemo(() => collapsePendingBaskets(rows), [rows]);
  const visibleRows = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return collapsed;
    return collapsed.filter((row) =>
      `${row.sourceSystem} ${row.basketRef ?? ''} ${row.sourceRef} ${row.sku ?? ''} ${row.payerLabel ?? ''} ${row.description} ${row.members.map((member) => member.description).join(' ')}`
        .toLowerCase()
        .includes(needle),
    );
  }, [collapsed, debouncedQ]);

  const receiptLines = useMemo(() => {
    if (!receipt) return [] as Array<{ qty: number; name: string; amount: number; currency: string }>;
    if (receipt.basketRef?.trim()) {
      return receipt.members.map((member) => ({
        qty: member.qty ?? 1,
        name: member.description,
        amount: Number(member.amount),
        currency: member.currency,
      }));
    }
    const parsed = parsePendingReceiptLines(receipt.description);
    const hasExplicitQty = /(?:^|: |\s)\d+(?:[.,]\d+)?\s*[x×]\s+/i.test(receipt.description);
    if (parsed.length > 1 || (parsed.length === 1 && hasExplicitQty)) {
      const qtySum = Math.max(1, parsed.reduce((sum, row) => sum + row.qty, 0));
      return parsed.map((line) => ({
        qty: line.qty,
        name: line.name,
        amount:
          parsed.length === 1
            ? Number(receipt.amount)
            : Math.round((Number(receipt.amount) / qtySum) * line.qty * 100) / 100,
        currency: receipt.currency,
      }));
    }
    return [
      {
        qty: receipt.qty ?? 1,
        name: receipt.description || receipt.sku || '—',
        amount: Number(receipt.amount),
        currency: receipt.currency,
      },
    ];
  }, [receipt]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setQ('')}>
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <HotelDataGrid<GridRow & Record<string, unknown>>
        columns={[
          { key: 'sourceSystem', header: t('colSource') },
          {
            key: 'sourceRef',
            header: t('colRef'),
            render: (r) => (r.basketCount > 1 ? t('basketLines', { count: r.basketCount }) : r.sourceRef.slice(0, 12)),
          },
          { key: 'payerLabel', header: t('colPayer'), render: (r) => r.payerLabel ?? '—' },
          { key: 'sku', header: t('colSku'), render: (r) => (r.basketCount > 1 ? '—' : r.sku ?? '—') },
          { key: 'qty', header: t('colQty'), render: (r) => (r.basketCount > 1 ? String(r.basketCount) : String(r.qty ?? 1)) },
          { key: 'description', header: t('colDescription') },
          {
            key: 'amount',
            header: t('colAmount'),
            render: (r) => `${Number(r.amount).toFixed(2)} ${r.currency}`,
          },
        ]}
        rows={visibleRows as (GridRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        onRowDoubleClick={(r) => {
          setReceipt(r);
          setVoidOpen(false);
          setVoidReason('');
        }}
        emptyMessage={loading ? tc('loading') : t('empty')}
      />

      <EraModal
        open={Boolean(receipt) && !voidOpen}
        onClose={() => setReceipt(null)}
        title={t('receiptTitle')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setReceipt(null)}>
              {tc('cancel')}
            </button>
            {canVoid && receipt?.basketCount === 1 ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setVoidOpen(true)}
              >
                {t('void')}
              </button>
            ) : null}
            {canPay ? (
              <>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void pay('CASH')}
                >
                  {t('payCash')}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void pay('CARD')}
                >
                  {t('payCard')}
                </button>
              </>
            ) : null}
          </div>
        }
      >
        {receipt ? (
          <div className="space-y-3 font-mono text-sm">
            <div className="space-y-1 border-b border-dashed border-[#D5DADF] pb-3 text-center text-xs text-[#7F8C8D]">
              <p className="text-[13px] font-semibold text-[#2C3E50]">
                {receipt.payerLabel?.trim() || receipt.sourceSystem}
              </p>
              <p>
                {receipt.basketCount > 1
                  ? t('basketLines', { count: receipt.basketCount })
                  : `${receipt.sourceSystem} · ${receipt.sourceRef.slice(0, 12)}`}
              </p>
              <p>{receipt.businessDate?.slice?.(0, 10) ?? receipt.businessDate}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D5DADF] text-left text-xs text-[#7F8C8D]">
                  <th className="py-1 pr-2 font-medium">{t('lineQty')}</th>
                  <th className="py-1 font-medium">{t('lineName')}</th>
                  <th className="py-1 pl-2 text-right font-medium">{t('lineAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {receiptLines.map((line, i) => (
                  <tr key={`${line.name}-${i}`} className="border-b border-dashed border-[#EEF1F4] last:border-0">
                    <td className="py-1.5 pr-2 align-top tabular-nums">{line.qty}</td>
                    <td className="py-1.5 align-top">{line.name}</td>
                    <td className="py-1.5 pl-2 text-right align-top tabular-nums whitespace-nowrap">
                      {line.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-baseline justify-between border-t border-dashed border-[#D5DADF] pt-3">
              <span className="text-xs uppercase tracking-wide text-[#7F8C8D]">{t('total')}</span>
              <span className="text-base font-semibold tabular-nums text-[#2C3E50]">
                {Number(receipt.amount).toFixed(2)} {receipt.currency}
              </span>
            </div>
            <p className="text-xs text-[#7F8C8D]">{t('amountReadOnly')}</p>
          </div>
        ) : null}
      </EraModal>

      <EraModal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title={t('voidModalTitle')}
        footer={
          <EraModalFooter
            onCancel={() => setVoidOpen(false)}
            onSubmit={() => void voidPending()}
            busy={busy}
            submitDisabled={voidReason.trim().length < 3}
            submitLabel={t('voidConfirm')}
          />
        }
      >
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t('voidReason')}
          <input
            className={MODAL_INPUT_CLASS}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </label>
      </EraModal>
    </>
  );
}
