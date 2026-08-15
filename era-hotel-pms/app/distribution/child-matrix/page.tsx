'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldRow,
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

type Row = {
  id: string;
  ageFrom: number;
  ageTo: number;
  discountPercent: number | string;
  amountOverride?: number | string | null;
  freeCount?: number;
  active?: boolean;
};

type FormState = {
  ageFrom: string;
  ageTo: string;
  discountPercent: string;
  amountOverride: string;
  freeCount: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  ageFrom: '0',
  ageTo: '6',
  discountPercent: '100',
  amountOverride: '',
  freeCount: '1',
  active: true,
});

export default function ChildMatrixPage() {
  const { can } = useAuth();
  const t = useTranslations('childMatrix');
  const tc = useTranslations('common');
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [rows, setRows] = useState<Row[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const formId = 'child-matrix-form';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/child-matrix');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(row.id);
    setForm({
      ageFrom: String(row.ageFrom),
      ageTo: String(row.ageTo),
      discountPercent: String(row.discountPercent),
      amountOverride: row.amountOverride == null ? '' : String(row.amountOverride),
      freeCount: String(row.freeCount ?? 0),
      active: row.active !== false,
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ageFrom: Number(form.ageFrom),
        ageTo: Number(form.ageTo),
        discountPercent: Number(form.discountPercent),
        amountOverride: form.amountOverride.trim() === '' ? null : Number(form.amountOverride),
        freeCount: Number(form.freeCount || 0),
        active: form.active,
      };
      const res = editingId
        ? await fetch(`/api/admin/child-matrix/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/child-matrix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(editingId ? t('updated') : t('created'));
      setModalOpen(false);
      await load();
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/child-matrix/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('deleted'));
      await load();
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        leading={
          <Link className="text-[13px] text-[#2980B9] hover:underline" href="/settings/pricing-policy">
            {t('policyLink')}
          </Link>
        }
      />

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-3 flex justify-end">
          {canWrite ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {tc('add')}
            </button>
          ) : null}
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ageFrom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ageTo')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('discount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('amountOverride')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('freeCount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.ageFrom}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.ageTo}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.discountPercent}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.amountOverride == null || row.amountOverride === ''
                      ? '—'
                      : row.amountOverride}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.freeCount ?? 0}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {canWrite ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={GHOST_BUTTON_CLASS}
                          onClick={() => openEdit(row)}
                          aria-label={tc('edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={GHOST_BUTTON_CLASS}
                          onClick={() => void remove(row.id)}
                          aria-label={tc('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={editingId ? t('editTitle') : t('addTitle')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={editingId ? tc('save') : tc('add')}
          />
        }
      >
        <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => void save(e)}>
          <FieldRow cols={2}>
            <Field
              label={t('ageFrom')}
              preset="count"
              type="number"
              value={form.ageFrom}
              onChange={(e) => setForm((f) => ({ ...f, ageFrom: e.target.value }))}
              required
            />
            <Field
              label={t('ageTo')}
              preset="count"
              type="number"
              value={form.ageTo}
              onChange={(e) => setForm((f) => ({ ...f, ageTo: e.target.value }))}
              required
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t('discount')}
              preset="count"
              type="number"
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
              required
            />
            <Field
              label={t('freeCount')}
              preset="count"
              type="number"
              value={form.freeCount}
              onChange={(e) => setForm((f) => ({ ...f, freeCount: e.target.value }))}
            />
          </FieldRow>
          <Field
            label={t('amountOverride')}
            preset="amount"
            type="number"
            step="0.01"
            value={form.amountOverride}
            onChange={(e) => setForm((f) => ({ ...f, amountOverride: e.target.value }))}
            placeholder={t('amountOverridePlaceholder')}
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
    </div>
  );
}
