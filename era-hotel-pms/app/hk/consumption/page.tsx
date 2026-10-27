'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Line = { id: string; sku: string; qty: number; businessDate?: string; reversed?: boolean };
type Lane = 'open' | 'closed';

export default function HkConsumptionPage() {
  const t = useTranslations('hkConsumption');
  const th = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [businessDate, setBusinessDate] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [closedLines, setClosedLines] = useState<Line[]>([]);
  const [lane, setLane] = useState<Lane>('open');
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [skuOptions, setSkuOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping/consumption');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setBusinessDate(String(data.businessDate ?? ''));
      setLines(Array.isArray(data.lines) ? data.lines : []);
      setClosedLines(Array.isArray(data.closedLines) ? data.closedLines : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsedQty = Number(qty);
    if (!sku.trim() || !Number.isFinite(parsedQty) || parsedQty === 0) {
      showApiError({ error: tc('required') }, tc('error'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: sku.trim(), qty: parsedQty }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('saveFailed'));
        return;
      }
      setQty('1');
      setSku('');
      showSuccess(t('saved'));
      setOpen(false);
      setLane('open');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reverse(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/housekeeping/consumption/${id}/reverse`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('saveFailed'));
        return;
      }
      showSuccess(t('reversed'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/housekeeping/consumption/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('saveFailed'));
        return;
      }
      showSuccess(t('deleted'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const tableRows = useMemo(() => (lane === 'open' ? lines : closedLines), [lane, lines, closedLines]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('hint', { date: businessDate || '—' })}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setSku('');
              setQty('1');
              setOpen(true);
            }}
          >
            + {t('addLine')}
          </button>
        }
      />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setLane('open')}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={th('kindFilter')}
          value={lane}
          onChange={(v) => setLane(String(v) === 'closed' ? 'closed' : 'open')}
          options={[
            { value: 'open', label: th('laneOpen') },
            { value: 'closed', label: th('laneClosed') },
          ]}
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              {lane === 'closed' ? <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('date')}</th> : null}
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sku')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('qty')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS} colSpan={lane === 'closed' ? 4 : 3}>
                  {lane === 'open' ? t('empty') : t('closedEmpty')}
                </td>
              </tr>
            ) : lane === 'open' ? (
              lines.map((line) => (
                <tr key={line.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{line.sku}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{line.qty}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() => void remove(line.id)}
                    >
                      {tc('delete')}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              closedLines.map((line) => (
                <tr key={line.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{line.businessDate}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{line.sku}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{line.qty}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={busy || line.reversed}
                      onClick={() => void reverse(line.id)}
                    >
                      {line.reversed ? t('reversed') : t('reverse')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <EraModal
        open={open}
        title={t('addLine')}
        onClose={() => setOpen(false)}
        footer={
          <EraModalFooter
            formId="hk-cons-add"
            onCancel={() => setOpen(false)}
            busy={busy}
            submitDisabled={!sku.trim()}
            submitLabel={tc('save')}
          />
        }
      >
        <form id="hk-cons-add" onSubmit={(e) => void save(e)} className="space-y-3">
          <CatalogField
            kind="SEARCHABLE"
            label={t('sku')}
            value={sku}
            serverSearch
            onQueryChange={(q) => {
              void fetch(
                `/api/housekeeping/finance-products?includeServices=1&limit=50&q=${encodeURIComponent(q)}`,
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((parsed) => {
                  const payload = (parsed?.data ?? parsed) as {
                    items?: Array<{ value: string; label: string }>;
                  } | null;
                  setSkuOptions(payload?.items ?? []);
                })
                .catch(() => setSkuOptions([]));
            }}
            options={
              sku && !skuOptions.some((option) => option.value === sku)
                ? [{ value: sku, label: sku }, ...skuOptions]
                : skuOptions
            }
            onChange={(next) => setSku(Array.isArray(next) ? (next[0] ?? '') : next)}
          />
          <Field
            label={t('qty')}
            preset="amount"
            type="number"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </form>
      </EraModal>
    </>
  );
}
