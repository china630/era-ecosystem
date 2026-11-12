'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  EraListFilterBar,
  GHOST_BUTTON_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
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
import { laundryItemDisplayName } from '@/lib/laundry-catalog-view';

type Item = {
  id: string;
  code: string;
  name: string;
  nameAz?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  category: string;
  washPrice: number | string | null;
  ironPrice: number | string | null;
  expressWashPrice: number | string | null;
  expressIronPrice: number | string | null;
  active: boolean;
};

type FormState = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  category: 'MEN' | 'WOMEN' | 'CHILD';
  washPrice: string;
  ironPrice: string;
  expressWashPrice: string;
  expressIronPrice: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  nameAz: '',
  nameRu: '',
  nameEn: '',
  category: 'MEN',
  washPrice: '',
  ironPrice: '',
  expressWashPrice: '',
  expressIronPrice: '',
  active: true,
});

function parsePrice(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function money(n: number | string | null | undefined) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : '—';
}

export default function LaundryCatalogPage() {
  const { can } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [rows, setRows] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/laundry/catalog');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setRows(json.items ?? []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (category && row.category !== category) return false;
      if (!needle) return true;
      const name = laundryItemDisplayName(row, locale).toLowerCase();
      return row.code.toLowerCase().includes(needle) || name.includes(needle);
    });
  }, [rows, q, category, locale]);

  if (!can(PERMISSIONS.HOUSEKEEPING_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(row: Item) {
    setEditId(row.id);
    setForm({
      code: row.code,
      nameAz: row.nameAz ?? '',
      nameRu: row.nameRu ?? '',
      nameEn: row.nameEn ?? row.name,
      category: (row.category === 'WOMEN' || row.category === 'CHILD' ? row.category : 'MEN') as
        | 'MEN'
        | 'WOMEN'
        | 'CHILD',
      washPrice: row.washPrice == null ? '' : String(Number(row.washPrice)),
      ironPrice: row.ironPrice == null ? '' : String(Number(row.ironPrice)),
      expressWashPrice: row.expressWashPrice == null ? '' : String(Number(row.expressWashPrice)),
      expressIronPrice: row.expressIronPrice == null ? '' : String(Number(row.expressIronPrice)),
      active: row.active,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      code: form.code,
      nameAz: form.nameAz,
      nameRu: form.nameRu,
      nameEn: form.nameEn,
      category: form.category,
      washPrice: parsePrice(form.washPrice),
      ironPrice: parsePrice(form.ironPrice),
      expressWashPrice: parsePrice(form.expressWashPrice),
      expressIronPrice: parsePrice(form.expressIronPrice),
      active: form.active,
    };
    const res = await fetch('/api/housekeeping/laundry/catalog', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editId ? { id: editId, ...body } : body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(json, tc('failed'));
      return;
    }
    showSuccess(tc('saved'));
    setOpen(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('laundryCatalogTitle')}
        subtitle={t('laundryCatalogHint')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {tc('add')}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setCategory('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tc('search')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('laundryCategory')}
          value={category}
          onChange={(v) => setCategory(String(v ?? ''))}
          options={[
            { value: '', label: tc('all') },
            { value: 'MEN', label: t('laundryCat_MEN') },
            { value: 'WOMEN', label: t('laundryCat_WOMEN') },
            { value: 'CHILD', label: t('laundryCat_CHILD') },
          ]}
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('laundryCategory')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('laundryWash')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('laundryIron')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('express')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {laundryItemDisplayName(row, locale)}
                  {!row.active ? ` (${t('laundryInactive')})` : ''}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {row.category === 'WOMEN' || row.category === 'CHILD' || row.category === 'MEN'
                    ? t(`laundryCat_${row.category}`)
                    : row.category}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{money(row.washPrice)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(row.ironPrice)}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {money(row.expressWashPrice)} / {money(row.expressIronPrice)}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className={`${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`}
                    aria-label={tc('edit')}
                    title={tc('edit')}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <EraModal
        open={open}
        title={editId ? tc('edit') : tc('add')}
        onClose={() => setOpen(false)}
        footer={
          <EraModalFooter
            formId="laundry-catalog-form"
            onCancel={() => setOpen(false)}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <form id="laundry-catalog-form" onSubmit={(e) => void save(e)} className={FORM_STACK_CLASS}>
          <Field
            label={tc('code')}
            preset="code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
          <Field
            label={t('laundryNameAz')}
            preset="shortText"
            value={form.nameAz}
            onChange={(e) => setForm({ ...form, nameAz: e.target.value })}
            required
          />
          <Field
            label={t('laundryNameRu')}
            preset="shortText"
            value={form.nameRu}
            onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
            required
          />
          <Field
            label={t('laundryNameEn')}
            preset="shortText"
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            required
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('laundryCategory')}
            value={form.category}
            onChange={(v) =>
              setForm({
                ...form,
                category: String(v) as 'MEN' | 'WOMEN' | 'CHILD',
              })
            }
            options={[
              { value: 'MEN', label: t('laundryCat_MEN') },
              { value: 'WOMEN', label: t('laundryCat_WOMEN') },
              { value: 'CHILD', label: t('laundryCat_CHILD') },
            ]}
          />
          <Field
            label={t('laundryWashPrice')}
            preset="code"
            value={form.washPrice}
            onChange={(e) => setForm({ ...form, washPrice: e.target.value })}
            placeholder="—"
          />
          <Field
            label={t('laundryIronPrice')}
            preset="code"
            value={form.ironPrice}
            onChange={(e) => setForm({ ...form, ironPrice: e.target.value })}
            placeholder="—"
          />
          <Field
            label={t('laundryExpressWashPrice')}
            preset="code"
            value={form.expressWashPrice}
            onChange={(e) => setForm({ ...form, expressWashPrice: e.target.value })}
            placeholder="—"
          />
          <Field
            label={t('laundryExpressIronPrice')}
            preset="code"
            value={form.expressIronPrice}
            onChange={(e) => setForm({ ...form, expressIronPrice: e.target.value })}
            placeholder="—"
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('laundryActive')}
            value={form.active ? 'yes' : 'no'}
            onChange={(v) => setForm({ ...form, active: String(v) === 'yes' })}
            options={[
              { value: 'yes', label: tc('yes') },
              { value: 'no', label: tc('no') },
            ]}
          />
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('laundryPriceEmptyHint')}</p>
        </form>
      </EraModal>
    </>
  );
}
