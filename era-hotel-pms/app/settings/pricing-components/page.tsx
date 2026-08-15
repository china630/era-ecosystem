'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Version = {
  id: string;
  sellAmount: number | null;
  cogsAmount: number | null;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

type ComponentRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  unit: string;
  current: Version | null;
  history: Version[];
};

type Recommended = {
  serviceFee: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  extraAdultBb: number;
  extraAdultFb: number;
  foodCogsDay: number | null;
  medicalCogs: number | null;
};

function money(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v.toFixed(2)} AZN`;
}

export default function PricingComponentsPage() {
  const { can } = useAuth();
  const t = useTranslations('pricingComponents');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [recommended, setRecommended] = useState<Recommended | null>(null);
  const [loading, setLoading] = useState(true);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [cogsAmount, setCogsAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyCode, setHistoryCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pricing-components');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(data.components ?? []);
      setRecommended(data.recommended ?? null);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openVersionModal(row: ComponentRow) {
    setEditCode(row.code);
    setSellAmount(row.current?.sellAmount != null ? String(row.current.sellAmount) : '');
    setCogsAmount(row.current?.cogsAmount != null ? String(row.current.cogsAmount) : '');
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setNote('');
  }

  async function submitVersion() {
    if (!editCode) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing-components/${editCode}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellAmount: sellAmount.trim() === '' ? null : parseFloat(sellAmount),
          cogsAmount: cogsAmount.trim() === '' ? null : parseFloat(cogsAmount),
          effectiveFrom,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('versionSaved'));
      setEditCode(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  const historyRow = rows.find((r) => r.code === historyCode);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        leading={
          <Link
            href="/settings/bar-calendar"
            className="text-[13px] text-[#2980B9] hover:underline"
          >
            {t('barCalendarLink')}
          </Link>
        }
      />

      {recommended ? (
        <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4 text-[13px] text-[#34495E]`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
            {t('recommendedTitle')}
          </p>
          <ul className="m-0 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              {t('extraAdultBb')}: <strong>{money(recommended.extraAdultBb)}</strong>
            </li>
            <li>
              {t('extraAdultFb')}: <strong>{money(recommended.extraAdultFb)}</strong>
            </li>
            <li>
              {t('serviceFee')}: {money(recommended.serviceFee)}
            </li>
            <li>
              {t('mealsSell')}: {money(recommended.breakfast)} / {money(recommended.lunch)} /{' '}
              {money(recommended.dinner)}
            </li>
            <li>
              {t('foodCogs')}: {money(recommended.foodCogsDay)}
            </li>
            <li>
              {t('medicalCogs')}: {money(recommended.medicalCogs)}
            </li>
          </ul>
        </section>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <section className={`${CARD_CONTAINER_CLASS} p-0`}>
          <div className={`${DATA_TABLE_VIEWPORT_CLASS} rounded-none border-0 shadow-none`}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('unit')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sell')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cogs')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('effectiveFrom')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{row.unit}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.current?.sellAmount)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{money(row.current?.cogsAmount)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.current?.effectiveFrom ?? '—'}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => openVersionModal(row)}
                        >
                          {t('newVersion')}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => setHistoryCode(row.code)}
                        >
                          {t('history')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EraModal
        open={editCode != null}
        title={t('newVersionTitle', { code: editCode ?? '' })}
        onClose={() => setEditCode(null)}
        footer={
          <EraModalFooter
            onCancel={() => setEditCode(null)}
            onSubmit={() => void submitVersion()}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('versionHint')}</p>
          <Field
            label={t('sell')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
          />
          <Field
            label={t('cogs')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={cogsAmount}
            onChange={(e) => setCogsAmount(e.target.value)}
          />
          <DatePicker
            label={t('effectiveFrom')}
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            placeholder={tc('datePlaceholder')}
            preset="date"
          />
          <Field
            label={t('note')}
            preset="longText"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </EraModal>

      <EraModal
        open={historyCode != null}
        title={t('historyTitle', { code: historyCode ?? '' })}
        onClose={() => setHistoryCode(null)}
        footer={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setHistoryCode(null)}
          >
            {tc('close')}
          </button>
        }
      >
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('effectiveFrom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('effectiveTo')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sell')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cogs')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('note')}</th>
              </tr>
            </thead>
            <tbody>
              {(historyRow?.history ?? []).map((v) => (
                <tr key={v.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{v.effectiveFrom}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{v.effectiveTo ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{money(v.sellAmount)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{money(v.cogsAmount)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{v.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EraModal>
    </>
  );
}
