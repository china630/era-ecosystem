'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Department = {
  id: string;
  code: string;
  name: string;
  cashPoint: string | null;
};

const CASH_POINTS = [
  { value: '', label: '—' },
  { value: 'HOTEL', label: 'HOTEL' },
  { value: 'FNB_POS', label: 'F&B' },
  { value: 'CLINIC', label: 'CLINIC' },
  { value: 'RETAIL', label: 'POS' },
];

export default function DepartmentsPage() {
  const { can } = useAuth();
  const t = useTranslations('masterData');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Department | null>(null);
  const [cashPoint, setCashPoint] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/master/departments');
    const data = await res.json();
    if (res.ok && Array.isArray(data)) setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('departmentsTitle')}
        subtitle={t('departmentsHint')}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setEdit(null);
              setCashPoint('');
              setOpen(true);
            }}
          >
            {tc('add')}
          </button>
        }
      />
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('cashPoint')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.cashPoint ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className="text-[#2980B9] hover:underline"
                    onClick={() => {
                      setEdit(row);
                      setCashPoint(row.cashPoint ?? '');
                      setOpen(true);
                    }}
                  >
                    {tc('edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <EraModal
        open={open}
        onClose={() => setOpen(false)}
        title={edit ? tc('edit') : tc('add')}
        footer={
          <EraModalFooter formId="department-form" onCancel={() => setOpen(false)} busy={busy} submitLabel={tc('save')} />
        }
      >
        <form
          id="department-form"
          className={FORM_STACK_CLASS}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const fd = new FormData(event.currentTarget);
            const body = edit
              ? { name: fd.get('name'), cashPoint: cashPoint || null }
              : { code: fd.get('code'), name: fd.get('name'), cashPoint: cashPoint || null };
            const res = await fetch(edit ? `/api/master/departments/${edit.id}` : '/api/master/departments', {
              method: edit ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            setBusy(false);
            if (!res.ok) {
              showApiError(await res.json().catch(() => null), tc('error'));
              return;
            }
            showSuccess(tc('saved'));
            setOpen(false);
            await load();
          }}
        >
          <Field label={tc('code')} preset="code" name="code" defaultValue={edit?.code ?? ''} readOnly={Boolean(edit)} required />
          <Field label={tc('name')} preset="shortText" name="name" defaultValue={edit?.name ?? ''} required />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('cashPoint')}
            value={cashPoint}
            onChange={(value) => setCashPoint(String(value ?? ''))}
            options={CASH_POINTS}
          />
        </form>
      </EraModal>
    </>
  );
}
