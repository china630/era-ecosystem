'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
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
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

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
  const [payTarget, setPayTarget] = useState<PendingRow | null>(null);
  const [voidTarget, setVoidTarget] = useState<PendingRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
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
    if (!payTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settlement/pending/${payTarget.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('payFailed'));
        return;
      }
      setPayTarget(null);
      showSuccess(t('paySuccess'));
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function voidPending() {
    if (!voidTarget || voidReason.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settlement/pending/${voidTarget.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('voidFailed'));
        return;
      }
      setVoidTarget(null);
      setVoidReason('');
      showSuccess(t('voidSuccess'));
      void load();
    } finally {
      setBusy(false);
    }
  }

  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const canVoid = can(PERMISSIONS.FOLIO_VOID);
  const visibleRows = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.sourceSystem} ${row.sourceRef} ${row.payerLabel ?? ''} ${row.description}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
          {loading ? (
            <p className="text-sm text-gray-500">{tc('loading')}</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-gray-600">{t('empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">{t('colSource')}</th>
                  <th className="py-2 pr-3">{t('colRef')}</th>
                  <th className="py-2 pr-3">{t('colPayer')}</th>
                  <th className="py-2 pr-3">{t('colDescription')}</th>
                  <th className="py-2 pr-3 text-right">{t('colAmount')}</th>
                  <th className="py-2">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{row.sourceSystem}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.sourceRef.slice(0, 12)}</td>
                    <td className="py-2 pr-3">{row.payerLabel ?? '—'}</td>
                    <td className="py-2 pr-3">{row.description}</td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {Number(row.amount).toFixed(2)} {row.currency}
                    </td>
                    <td className="py-2 space-x-2">
                      {canPay && (
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          onClick={() => setPayTarget(row)}
                        >
                          {t('pay')}
                        </button>
                      )}
                      {canVoid && (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => {
                            setVoidTarget(row);
                            setVoidReason('');
                          }}
                        >
                          {t('void')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <EraModal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={t('payModalTitle')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPayTarget(null)}>
              {tc('cancel')}
            </button>
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
          </div>
        }
      >
        {payTarget && (
          <div className="space-y-3 text-sm">
            <p>{payTarget.description}</p>
            <p className="font-semibold">
              {Number(payTarget.amount).toFixed(2)} {payTarget.currency}
            </p>
            <p className="text-xs text-gray-500">{t('amountReadOnly')}</p>
          </div>
        )}
      </EraModal>

      <EraModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={t('voidModalTitle')}
        footer={
          <EraModalFooter
            onCancel={() => setVoidTarget(null)}
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
