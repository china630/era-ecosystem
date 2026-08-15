'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type YieldRule = {
  id: string;
  propertyCode: string;
  minOccupancyPct: number | string;
  rateAdjustment: number | string;
  active: boolean;
  createdAt: string;
};

type FormState = {
  propertyCode: string;
  minOccupancyPct: string;
  rateAdjustment: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  propertyCode: 'DEFAULT',
  minOccupancyPct: '70',
  rateAdjustment: '5',
  active: true,
});

export default function YieldRulesPage() {
  const { can } = useAuth();
  const t = useTranslations('yieldRules');
  const tc = useTranslations('common');
  const [rules, setRules] = useState<YieldRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const formId = 'yield-rule-form';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/yield-rules');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('loadFailed'));
        return;
      }
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t('loadFailed') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRules = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) => r.propertyCode.toLowerCase().includes(q));
  }, [rules, debouncedQ]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(rule: YieldRule) {
    setEditingId(rule.id);
    setForm({
      propertyCode: rule.propertyCode,
      minOccupancyPct: String(rule.minOccupancyPct),
      rateAdjustment: String(rule.rateAdjustment),
      active: rule.active,
    });
    setModalOpen(true);
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        propertyCode: form.propertyCode.trim(),
        minOccupancyPct: Number(form.minOccupancyPct),
        rateAdjustment: Number(form.rateAdjustment),
        active: form.active,
      };
      const res = editingId
        ? await fetch(`/api/admin/yield-rules/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/yield-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(editingId ? t('updated') : t('created'));
      setModalOpen(false);
      await load();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    }
  }

  async function removeRule(id: string) {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin/yield-rules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('deleted'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionMasterData')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('addRule')}
          </button>
        }
      />

      <p className={`${CARD_CONTAINER_CLASS} mb-3 p-3 text-[13px] text-[#34495E]`}>
        {t('masterToggleHint')}{' '}
        <a className="text-[#2980B9] hover:underline" href="/settings/pricing-policy">
          {t('pricingPolicyLink')}
        </a>
      </p>

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
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('propertyCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('minOccupancy')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rateAdjustment')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('active')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.propertyCode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.minOccupancyPct}%</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.rateAdjustment}%</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.active ? tc('yes') : tc('no')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex gap-2">
                      <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {tc('edit')}
                      </button>
                      <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void removeRule(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {tc('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={editingId ? t('editRule') : t('addRule')}
        subtitle={t('formHint')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={editingId ? tc('save') : t('addRule')}
          />
        }
      >
        <form id={formId} onSubmit={saveRule} className={FORM_STACK_CLASS}>
          <Field
            label={t('propertyCode')}
            preset="code"
            id="yield-property"
            value={form.propertyCode}
            onChange={(e) => setForm((f) => ({ ...f, propertyCode: e.target.value }))}
            required
          />
          <Field
            label={t('minOccupancy')}
            preset="count"
            id="yield-occupancy"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.minOccupancyPct}
            onChange={(e) => setForm((f) => ({ ...f, minOccupancyPct: e.target.value }))}
            required
          />
          <Field
            label={t('rateAdjustment')}
            preset="amount"
            id="yield-adjustment"
            type="number"
            step="0.01"
            value={form.rateAdjustment}
            onChange={(e) => setForm((f) => ({ ...f, rateAdjustment: e.target.value }))}
            required
          />
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            {t('active')}
          </label>
        </form>
      </EraModal>
    </>
  );
}
