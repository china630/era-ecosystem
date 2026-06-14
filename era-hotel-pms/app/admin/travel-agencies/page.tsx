'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { ListFilterInput } from '@/components/master-data/ListFilterInput';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesActiveFilter, matchesCodeNameQuery } from '@/lib/list-filter';

type AgencyRow = {
  id: string;
  code: string;
  name: string;
  voen: string | null;
  commissionPercent: string | null;
  active: boolean;
};

export default function TravelAgenciesPage() {
  const { can } = useAuth();
  const t = useTranslations('travelAgencies');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<AgencyRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<AgencyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/travel-agencies');
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [tc]);

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can, load]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) => matchesCodeNameQuery(r, search) && matchesActiveFilter(r, activeFilter),
      ),
    [rows, search, activeFilter],
  );

  const formId = 'travel-agency-form';

  function openCreate() {
    setEditRow(null);
    setModalOpen(true);
  }

  function openEdit(row: AgencyRow) {
    setEditRow(row);
    setModalOpen(true);
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader
        title={t('title')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListFilterInput value={search} onChange={setSearch} placeholder={t('filterPlaceholder')} />
        <select
          className={`${MODAL_INPUT_CLASS} max-w-[140px] text-[13px]`}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="ALL">{t('allStatuses')}</option>
          <option value="ACTIVE">{t('activeOnly')}</option>
          <option value="INACTIVE">{t('inactiveOnly')}</option>
        </select>
      </div>
      <EraDataGrid<AgencyRow & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code') },
          { key: 'name', header: t('name') },
          { key: 'voen', header: 'VÖEN', render: (r) => r.voen ?? '—' },
          { key: 'commissionPercent', header: t('commission'), render: (r) => r.commissionPercent ?? '—' },
          { key: 'active', header: t('active'), render: (r) => String(r.active) },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) => (
              <button type="button" className="text-[#2980B9] hover:underline" onClick={() => openEdit(r)}>
                {tc('edit')}
              </button>
            ),
          },
        ]}
        rows={filteredRows as (AgencyRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
      />

      <EraModal
        open={modalOpen}
        title={editRow ? t('title') : t('title')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={editRow ? tc('save') : tc('add')}
          />
        }
      >
        <form
          id={formId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/admin/travel-agencies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: editRow?.id,
                code: fd.get('code'),
                name: fd.get('name'),
                voen: (fd.get('voen') as string) || undefined,
                commissionPercent: fd.get('commission')
                  ? Number(fd.get('commission'))
                  : undefined,
                active: fd.get('active') === 'on',
              }),
            });
            setBusy(false);
            if (res.ok) {
              setModalOpen(false);
              setEditRow(null);
              await load();
            } else {
              const data = await res.json();
              setMsg(data.error ?? tc('error'));
            }
          }}
        >
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ag-code">{t('code')}</label>
            <input
              id="ag-code"
              name="code"
              className={MODAL_INPUT_CLASS}
              defaultValue={editRow?.code ?? ''}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ag-name">{t('name')}</label>
            <input
              id="ag-name"
              name="name"
              className={MODAL_INPUT_CLASS}
              defaultValue={editRow?.name ?? ''}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ag-voen">VÖEN</label>
            <input
              id="ag-voen"
              name="voen"
              className={MODAL_INPUT_CLASS}
              defaultValue={editRow?.voen ?? ''}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ag-commission">{t('commission')}</label>
            <input
              id="ag-commission"
              name="commission"
              type="number"
              step="0.01"
              className={MODAL_INPUT_CLASS}
              defaultValue={editRow?.commissionPercent ?? ''}
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              name="active"
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              defaultChecked={editRow?.active ?? true}
            />
            {t('active')}
          </label>
        </form>
      </EraModal>
    </AppShell>
  );
}
