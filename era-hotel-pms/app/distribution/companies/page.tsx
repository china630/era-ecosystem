'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CatalogField,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  VoenLookupField,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesActiveFilter, matchesCodeNameQuery } from '@/lib/list-filter';

type CompanyRow = {
  id: string;
  code: string;
  name: string;
  voen: string | null;
  settlementMode?: 'PREPAID' | 'POSTPAID';
  active: boolean;
};

export default function CompaniesPage() {
  const { can } = useAuth();
  const t = useTranslations('companies');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<CompanyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [voen, setVoen] = useState('');
  const [nameHint, setNameHint] = useState('');
  const [settlementMode, setSettlementMode] = useState<'PREPAID' | 'POSTPAID'>('POSTPAID');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/companies');
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
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can, load]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) => matchesCodeNameQuery(r, debouncedQ) && matchesActiveFilter(r, activeFilter),
      ),
    [rows, debouncedQ, activeFilter],
  );

  const formId = 'company-form';

  function openCreate() {
    setEditRow(null);
    setVoen('');
    setNameHint('');
    setSettlementMode('POSTPAID');
    setModalOpen(true);
  }

  function openEdit(row: CompanyRow) {
    setEditRow(row);
    setVoen(row.voen ?? '');
    setNameHint('');
    setSettlementMode(row.settlementMode === 'PREPAID' ? 'PREPAID' : 'POSTPAID');
    setModalOpen(true);
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setActiveFilter('ALL');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('filterPlaceholder')}
        />
        <FieldSelect
          label={tc('status')}
          preset="select"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="ALL">{t('allStatuses')}</option>
          <option value="ACTIVE">{t('activeOnly')}</option>
          <option value="INACTIVE">{t('inactiveOnly')}</option>
        </FieldSelect>
      </EraListFilterBar>
      <HotelDataGrid<CompanyRow & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code') },
          { key: 'name', header: t('name') },
          { key: 'voen', header: 'VÖEN', render: (r) => r.voen ?? '—' },
          {
            key: 'settlementMode',
            header: t('settlementMode'),
            render: (r) => t(r.settlementMode === 'PREPAID' ? 'prepaid' : 'postpaid'),
          },
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
        rows={filteredRows as (CompanyRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
      />

      <EraModal
        open={modalOpen}
        title={t('title')}
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
            try {
              const fd = new FormData(e.currentTarget);
              const res = await fetch('/api/admin/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: editRow?.id,
                  code: fd.get('code'),
                  name: fd.get('name'),
                  voen: voen || (fd.get('voen') as string) || undefined,
                  settlementMode,
                  active: fd.get('active') === 'on',
                }),
              });
              setBusy(false);
              if (res.ok) {
                setModalOpen(false);
                setEditRow(null);
                showSuccess(tc('saved'));
                await load();
              } else {
                const data = await res.json();
                showApiError(data, tc('error'));
              }
            } catch (err) {
              setBusy(false);
              showApiError({ error: err instanceof Error ? err.message : tc('error') });
            }
          }}
        >
          <Field
            label={t('code')}
            preset="code"
            name="code"
            defaultValue={editRow?.code ?? ''}
            required
          />
          <Field
            label={t('name')}
            preset="shortText"
            name="name"
            defaultValue={editRow?.name ?? ''}
            required
          />
          <VoenLookupField
            value={voen}
            onChange={setVoen}
            onResolved={(r) => {
              if (r.found && r.name) setNameHint(r.name);
            }}
            labels={{
              voen: 'VÖEN',
              check: tc('check'),
              found: tc('found'),
              notFound: tc('notFound'),
              invalid: tc('invalid'),
            }}
          />
          {nameHint ? <p className="text-xs text-[#7F8C8D]">{nameHint}</p> : null}
          <input type="hidden" name="voen" value={voen} />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('settlementMode')}
            value={settlementMode}
            onChange={(v) => setSettlementMode(v === 'PREPAID' ? 'PREPAID' : 'POSTPAID')}
            options={[
              { value: 'POSTPAID', label: t('postpaid') },
              { value: 'PREPAID', label: t('prepaid') },
            ]}
          />
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
    </>
  );
}
