'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, UserPlus } from 'lucide-react';
import {
  CatalogField,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldRow,
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
import { isOtaAgency } from '@/lib/booking-source-kind';

type AgencyRow = {
  id: string;
  code: string;
  name: string;
  voen: string | null;
  commissionPercent: string | number | null;
  settlementMode?: 'PREPAID' | 'POSTPAID';
  creditLimitAzn?: string | number | null;
  paymentTermsDays?: number | null;
  financeCounterpartyId?: string | null;
  active: boolean;
};

function catalogStr(v: string | string[]): string {
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

function financeHint(row: AgencyRow, t: (key: string) => string): string {
  if (row.financeCounterpartyId) return t('financeLinked');
  if (row.voen && row.voen.replace(/\D/g, '').length === 10) return t('financeVoenOnly');
  return t('financeMissing');
}

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
  const [settlementFilter, setSettlementFilter] = useState('');
  const [agencyVoen, setAgencyVoen] = useState('');
  const [agencyNameHint, setAgencyNameHint] = useState('');
  const [settlementMode, setSettlementMode] = useState<'PREPAID' | 'POSTPAID'>('POSTPAID');
  const [creditLimitAzn, setCreditLimitAzn] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');

  const [inviteAgency, setInviteAgency] = useState<AgencyRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  const statusOptions = useMemo(
    () => [
      { value: 'ALL', label: t('allStatuses') },
      { value: 'ACTIVE', label: t('activeOnly') },
      { value: 'INACTIVE', label: t('inactiveOnly') },
    ],
    [t],
  );
  const settlementFilterOptions = useMemo(
    () => [
      { value: '', label: tc('all') },
      { value: 'POSTPAID', label: t('postpaid') },
      { value: 'PREPAID', label: t('prepaid') },
    ],
    [t, tc],
  );

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
      rows.filter((r) => {
        if (!matchesCodeNameQuery(r, debouncedQ)) return false;
        if (!matchesActiveFilter(r, activeFilter)) return false;
        if (settlementFilter) {
          const mode = r.settlementMode === 'PREPAID' ? 'PREPAID' : 'POSTPAID';
          if (mode !== settlementFilter) return false;
        }
        return true;
      }),
    [rows, debouncedQ, activeFilter, settlementFilter],
  );

  const formId = 'travel-agency-form';

  function openCreate() {
    setEditRow(null);
    setAgencyVoen('');
    setAgencyNameHint('');
    setSettlementMode('POSTPAID');
    setCreditLimitAzn('');
    setPaymentTermsDays('');
    setModalOpen(true);
  }

  function openEdit(row: AgencyRow) {
    setEditRow(row);
    setAgencyVoen(row.voen ?? '');
    setAgencyNameHint('');
    setSettlementMode(row.settlementMode === 'PREPAID' ? 'PREPAID' : 'POSTPAID');
    setCreditLimitAzn(row.creditLimitAzn != null && row.creditLimitAzn !== '' ? String(row.creditLimitAzn) : '');
    setPaymentTermsDays(row.paymentTermsDays != null ? String(row.paymentTermsDays) : '');
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
      <p className="mb-4 text-xs text-[#7F8C8D]">{t('productNote')}</p>

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setActiveFilter('ALL');
          setSettlementFilter('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('filterPlaceholder')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc('status')}
          value={activeFilter}
          onChange={(v) => setActiveFilter(catalogStr(v) || 'ALL')}
          options={statusOptions}
          emptyLabel={null}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('settlementMode')}
          value={settlementFilter}
          onChange={(v) => setSettlementFilter(catalogStr(v))}
          options={settlementFilterOptions}
          emptyLabel={null}
        />
      </EraListFilterBar>

      <HotelDataGrid<AgencyRow & Record<string, unknown>>
        columns={[
          { key: 'name', header: t('name') },
          {
            key: 'code',
            header: t('code'),
            render: (r) => (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span>{r.code}</span>
                {isOtaAgency(r.code, r.name) ? (
                  <span className="rounded bg-[#ECF0F1] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#7F8C8D]">
                    OTA
                  </span>
                ) : null}
              </span>
            ),
          },
          { key: 'voen', header: 'VÖEN', render: (r) => r.voen ?? '—' },
          {
            key: 'commissionPercent',
            header: t('commission'),
            render: (r) => r.commissionPercent ?? '—',
          },
          {
            key: 'settlementMode',
            header: t('settlementMode'),
            render: (r) => t(r.settlementMode === 'PREPAID' ? 'prepaid' : 'postpaid'),
          },
          {
            key: 'finance',
            header: t('finance'),
            render: (r) => (
              <span className="text-[12px] text-[#7F8C8D]" title={t('financeHint')}>
                {financeHint(r, t)}
              </span>
            ),
          },
          {
            key: 'active',
            header: t('active'),
            render: (r) => (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  r.active
                    ? 'bg-[#E8F8F5] text-[#1E8449]'
                    : 'bg-[#F5F6F7] text-[#7F8C8D]'
                }`}
              >
                {r.active ? t('activeBadge') : t('inactiveBadge')}
              </span>
            ),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) => (
              <span className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#BDC3C7] text-[#2C3E50] hover:bg-[#ECF0F1]"
                  title={tc('edit')}
                  aria-label={tc('edit')}
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#BDC3C7] text-[#2C3E50] hover:bg-[#ECF0F1] disabled:opacity-50"
                  title={t('invitePortal')}
                  aria-label={t('invitePortal')}
                  disabled={busy}
                  onClick={() => {
                    setInviteAgency(r);
                    setInviteEmail('');
                  }}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
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
        title={editRow ? t('editTitle') : t('createTitle')}
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
                  creditLimitAzn: creditLimitAzn.trim() === '' ? null : Number(creditLimitAzn),
                  paymentTermsDays:
                    paymentTermsDays.trim() === '' ? null : Number(paymentTermsDays),
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
          <FieldRow cols={2}>
            <Field
              label={t('name')}
              preset="shortText"
              id="ag-name"
              name="name"
              defaultValue={editRow?.name ?? ''}
              required
            />
            <Field
              label={t('code')}
              preset="code"
              id="ag-code"
              name="code"
              defaultValue={editRow?.code ?? ''}
              required
            />
          </FieldRow>
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
          {agencyNameHint ? <p className="text-xs text-[#7F8C8D]">{agencyNameHint}</p> : null}
          {editRow ? (
            <p className="text-xs text-[#7F8C8D]">
              {t('financeHint')}: {financeHint(editRow, t)}
            </p>
          ) : (
            <p className="text-xs text-[#7F8C8D]">{t('financeHint')}</p>
          )}
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
            onChange={(v) => setSettlementMode(catalogStr(v) === 'PREPAID' ? 'PREPAID' : 'POSTPAID')}
            options={[
              { value: 'POSTPAID', label: t('postpaid') },
              { value: 'PREPAID', label: t('prepaid') },
            ]}
            emptyLabel={null}
          />
          <FieldRow cols={2}>
            <Field
              label={t('creditLimitAzn')}
              preset="amount"
              type="number"
              min={0}
              step="0.01"
              value={creditLimitAzn}
              onChange={(e) => setCreditLimitAzn(e.target.value)}
              hint={t('creditLimitHint')}
            />
            <Field
              label={t('paymentTermsDays')}
              preset="count"
              type="number"
              min={0}
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              hint={t('paymentTermsHint')}
            />
          </FieldRow>
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
