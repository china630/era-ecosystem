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
import { HotelDataGrid } from "@/components/HotelDataGrid";
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesActiveFilter, matchesCodeNameQuery } from '@/lib/list-filter';

type AgencyRow = {
  id: string;
  code: string;
  name: string;
  voen: string | null;
  commissionPercent: string | null;
  settlementMode?: 'PREPAID' | 'POSTPAID';
  active: boolean;
};

export default function TravelAgenciesPage() {
  const { can } = useAuth();
  const t = useTranslations('travelAgencies');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<AgencyRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<AgencyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [agencyVoen, setAgencyVoen] = useState('');
  const [agencyNameHint, setAgencyNameHint] = useState('');
  const [settlementMode, setSettlementMode] = useState<'PREPAID' | 'POSTPAID'>('POSTPAID');

  const [inviteAgency, setInviteAgency] = useState<AgencyRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/travel-agencies');
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

  const formId = 'travel-agency-form';

  function openCreate() {
    setEditRow(null);
    setAgencyVoen('');
    setAgencyNameHint('');
    setSettlementMode('POSTPAID');
    setModalOpen(true);
  }

  function openEdit(row: AgencyRow) {
    setEditRow(row);
    setAgencyVoen(row.voen ?? '');
    setAgencyNameHint('');
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
      <HotelDataGrid<AgencyRow & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code') },
          { key: 'name', header: t('name') },
          { key: 'voen', header: 'VÖEN', render: (r) => r.voen ?? '—' },
          { key: 'commissionPercent', header: t('commission'), render: (r) => r.commissionPercent ?? '—' },
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
              <span className="flex flex-wrap gap-2">
                <button type="button" className="text-[#2980B9] hover:underline" onClick={() => openEdit(r)}>
                  {tc('edit')}
                </button>
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  disabled={busy}
                  onClick={() => {
                    setInviteAgency(r);
                    setInviteEmail('');
                  }}
                >
                  {t('invitePortal')}
                </button>
              </span>
            ),
          },
        ]}
        rows={filteredRows as (AgencyRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
      />

      <EraModal
        open={Boolean(inviteAgency)}
        title={t('invitePortal')}
        onClose={() => setInviteAgency(null)}
        footer={
          <EraModalFooter
            formId="agency-portal-invite-form"
            onCancel={() => setInviteAgency(null)}
            busy={busy}
            submitLabel={t('invitePortal')}
          />
        }
      >
        <form
          id="agency-portal-invite-form"
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!inviteAgency) return;
            if (!inviteAgency.voen || inviteAgency.voen.replace(/\D/g, '').length !== 10) {
              showApiError({ error: t('inviteNeedVoen') });
              return;
            }
            setBusy(true);
            try {
              const res = await fetch(`/api/admin/travel-agencies/${inviteAgency.id}/portal-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail.trim() }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                showApiError(data, tc('error'));
                return;
              }
              const temp = data.temporaryPassword
                ? ` temp password: ${data.temporaryPassword}`
                : '';
              showSuccess(t('inviteOk') + temp);
              setInviteAgency(null);
            } catch (err) {
              showApiError({ error: err instanceof Error ? err.message : tc('error') });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Email"
            preset="longText"
            type="email"
            value={inviteEmail}
            onChange={(ev) => setInviteEmail(ev.target.value)}
            required
          />
        </form>
      </EraModal>

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
              const res = await fetch('/api/admin/travel-agencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: editRow?.id,
                  code: fd.get('code'),
                  name: fd.get('name'),
                  voen: agencyVoen || (fd.get('voen') as string) || undefined,
                  commissionPercent: fd.get('commission')
                    ? Number(fd.get('commission'))
                    : undefined,
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
            id="ag-code"
            name="code"
            defaultValue={editRow?.code ?? ''}
            required
          />
          <Field
            label={t('name')}
            preset="shortText"
            id="ag-name"
            name="name"
            defaultValue={editRow?.name ?? ''}
            required
          />
          <VoenLookupField
            value={agencyVoen}
            onChange={setAgencyVoen}
            onResolved={(r) => {
              if (r.found && r.name) setAgencyNameHint(r.name);
            }}
            labels={{
              voen: 'VÖEN',
              check: tc('check'),
              found: tc('found'),
              notFound: tc('notFound'),
              invalid: tc('invalid'),
            }}
          />
          {agencyNameHint ? (
            <p className="text-xs text-[#7F8C8D]">{agencyNameHint}</p>
          ) : null}
          <input type="hidden" name="voen" value={agencyVoen} />
          <Field
            label={t('commission')}
            preset="amount"
            id="ag-commission"
            name="commission"
            type="number"
            step="0.01"
            defaultValue={editRow?.commissionPercent ?? ''}
          />
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
