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

type PendingRow = {
  id: string;
  sourceSystem: string;
  sourceRef: string;
  amount: string | number;
  currency: string;
  description: string;
  payerLabel: string | null;
  createdAt: string;
  businessDate: string;
};

export default function FrontCashPendingPage() {
  const { can } = useAuth();
  const t = useTranslations('frontCashPending');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PendingRow | null>(null);
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
    try {
      const res = await fetch(`/api/settlement/pending/${receipt.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('payFailed'));
        return;
      }
      setReceipt(null);
      showSuccess(t('paySuccess'));
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
  const visibleRows = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.sourceSystem} ${row.sourceRef} ${row.payerLabel ?? ''} ${row.description}`
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, debouncedQ]);

  const lines = receipt ? parsePendingReceiptLines(receipt.description) : [];

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
      <HotelDataGrid<PendingRow & Record<string, unknown>>
        columns={[
          { key: 'sourceSystem', header: t('colSource') },
          { key: 'sourceRef', header: t('colRef'), render: (r) => r.sourceRef.slice(0, 12) },
          { key: 'payerLabel', header: t('colPayer'), render: (r) => r.payerLabel ?? '—' },
          { key: 'description', header: t('colDescription') },
          {
            key: 'amount',
            header: t('colAmount'),
            render: (r) => `${Number(r.amount).toFixed(2)} ${r.currency}`,
          },
          {
            key: 'open',
            header: t('colActions'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => {
                  setReceipt(r);
                  setVoidOpen(false);
                  setVoidReason('');
                }}
              >
                {t('openReceipt')}
              </button>
            ),
          },
        ]}
        rows={visibleRows as (PendingRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
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
            {canVoid ? (
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
          <div className="space-y-3 text-sm">
            <p className="text-xs text-[#7F8C8D]">
              {receipt.sourceSystem} · {receipt.payerLabel ?? '—'}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-[#7F8C8D]">
                  <th className="py-1 pr-2">{t('lineQty')}</th>
                  <th className="py-1">{t('lineName')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={`${line.name}-${i}`} className="border-b last:border-0">
                    <td className="py-1 pr-2">{line.qty}</td>
                    <td className="py-1">{line.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="font-semibold">
              {Number(receipt.amount).toFixed(2)} {receipt.currency}
            </p>
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
