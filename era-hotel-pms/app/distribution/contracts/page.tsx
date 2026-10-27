'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  EraMenu,
  EraMenuItem,
  useDebouncedValue,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateDisplay } from '@era/satellite-kit/time';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Agency = { id: string; code: string; name: string };
type Company = { id: string; code: string; name: string; active?: boolean };
type RatePlan = { id: string; code: string; name: string; type: string };
type RoomType = { id: string; code: string; name: string };
type Allotment = {
  id: string;
  roomTypeId: string;
  validFrom: string;
  validTo: string;
  nightlyQuota: number;
  releaseDays?: number;
  roomType: RoomType;
};
type Contract = {
  id: string;
  code: string;
  name: string;
  status: string;
  counterpartyType: 'AGENCY' | 'CORPORATE' | string;
  validFrom: string;
  validTo: string | null;
  commissionPercent: number | string | null;
  commissionBasis: 'GROSS' | 'NET' | string;
  depositRequired: boolean;
  depositAmount: number | string | null;
  notes: string | null;
  externalRef: string | null;
  minStay: number | null;
  cta: boolean;
  ctd: boolean;
  agencyId: string | null;
  companyId: string | null;
  ratePlanId: string;
  agency: Agency | null;
  company: Company | null;
  ratePlan: RatePlan;
  allotments: Allotment[];
  _count: { reservations: number };
};

type CounterpartyType = 'AGENCY' | 'CORPORATE';

function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return '';
  const s = typeof v === 'string' ? v : v.toISOString();
  return s.slice(0, 10);
}

function emptyContractForm() {
  return {
    code: '',
    name: '',
    counterpartyType: 'AGENCY' as CounterpartyType,
    agencyId: '',
    companyId: '',
    ratePlanId: '',
    validFrom: '',
    validTo: '',
    commissionPercent: '',
    commissionBasis: 'GROSS' as 'GROSS' | 'NET',
    depositRequired: false,
    depositAmount: '',
    notes: '',
    externalRef: '',
    minStay: '',
    cta: false,
    ctd: false,
  };
}

function emptyAllotmentForm() {
  return {
    id: '' as string | undefined,
    roomTypeId: '',
    validFrom: '',
    validTo: '',
    nightlyQuota: '',
    releaseDays: '0',
  };
}

function catalogStr(v: string | string[]): string {
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

export default function SalesContractsPage() {
  const { can } = useAuth();
  const t = useTranslations('salesContracts');
  const tc = useTranslations('common');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manageContract, setManageContract] = useState<Contract | null>(null);
  const [allotmentFormOpen, setAllotmentFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [utilizationModal, setUtilizationModal] = useState<{
    code: string;
    reservationCount: number;
    allotmentNights: number;
    consumedNights: number;
    utilizationPercent: number | null;
    totalRevenue: number;
  } | null>(null);

  const [form, setForm] = useState(emptyContractForm);
  const [allotForm, setAllotForm] = useState(emptyAllotmentForm);
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | CounterpartyType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | string>('ALL');
  const [draftTouched, setDraftTouched] = useState(false);
  const debouncedQ = useDebouncedValue(q, 300);

  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [agencies],
  );
  const companyOptions = useMemo(
    () => companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [companies],
  );
  const ratePlanOptions = useMemo(
    () => ratePlans.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [ratePlans],
  );
  const roomTypeOptions = useMemo(
    () => roomTypes.map((rt) => ({ value: rt.id, label: `${rt.code} — ${rt.name}` })),
    [roomTypes],
  );

  const load = useCallback(async () => {
    try {
      const [cRes, aRes, coRes, rpRes, rtRes] = await Promise.all([
        fetch('/api/admin/contracts'),
        fetch('/api/admin/travel-agencies'),
        fetch('/api/admin/companies'),
        fetch('/api/master/rate-plans'),
        fetch('/api/master/room-types'),
      ]);
      const [cData, aData, coData, rpData, rtData] = await Promise.all([
        cRes.json(),
        aRes.json(),
        coRes.json(),
        rpRes.json(),
        rtRes.json(),
      ]);
      if (!cRes.ok) {
        showApiError(cData, tc('loadError'));
        return;
      }
      setContracts(Array.isArray(cData) ? cData : []);
      setAgencies(Array.isArray(aData) ? aData : []);
      setCompanies(
        (Array.isArray(coData) ? coData : []).filter((c: Company) => c.active !== false),
      );
      setRatePlans(
        (Array.isArray(rpData) ? rpData : []).filter(
          (p: RatePlan) => p.type === 'DERIVED' || p.type === 'BASE',
        ),
      );
      setRoomTypes(Array.isArray(rtData) ? rtData : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can, load]);

  const filteredContracts = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return contracts.filter((c) => {
      if (filterType !== 'ALL' && c.counterpartyType !== filterType) return false;
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
      if (!needle) return true;
      return (
        c.code.toLowerCase().includes(needle) ||
        c.name.toLowerCase().includes(needle) ||
        (c.agency?.code ?? '').toLowerCase().includes(needle) ||
        (c.agency?.name ?? '').toLowerCase().includes(needle) ||
        (c.company?.code ?? '').toLowerCase().includes(needle) ||
        (c.company?.name ?? '').toLowerCase().includes(needle) ||
        c.ratePlan.code.toLowerCase().includes(needle)
      );
    });
  }, [contracts, debouncedQ, filterType, filterStatus]);

  function statusLabel(status: string) {
    if (status === 'DRAFT') return t('statusDraft');
    if (status === 'ACTIVE') return t('statusActive');
    if (status === 'EXPIRED') return t('statusExpired');
    if (status === 'CANCELLED') return t('statusCancelled');
    return status;
  }

  function applyDraftCodeName(next: {
    counterpartyType?: CounterpartyType;
    agencyId?: string;
    companyId?: string;
    ratePlanId?: string;
  }) {
    if (editingId || draftTouched) return;
    const type = next.counterpartyType ?? form.counterpartyType;
    const agencyId = next.agencyId ?? form.agencyId;
    const companyId = next.companyId ?? form.companyId;
    const ratePlanId = next.ratePlanId ?? form.ratePlanId;
    const party =
      type === 'CORPORATE'
        ? companies.find((c) => c.id === companyId)
        : agencies.find((a) => a.id === agencyId);
    const rate = ratePlans.find((p) => p.id === ratePlanId);
    if (!party || !rate) return;
    const rateShort = rate.code.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12).toUpperCase() || 'RATE';
    const code = `${party.code}-${rateShort}`.slice(0, 32).toUpperCase();
    const name = `${party.name} — ${rate.name || rate.code}`;
    setForm((f) => ({ ...f, code, name }));
  }

  const managedLive = useMemo(() => {
    if (!manageContract) return null;
    return contracts.find((c) => c.id === manageContract.id) ?? manageContract;
  }, [contracts, manageContract]);

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  function counterpartyLabel(c: Contract) {
    if (c.counterpartyType === 'CORPORATE') {
      return c.company ? `${c.company.code} — ${c.company.name}` : '—';
    }
    return c.agency ? `${c.agency.code} — ${c.agency.name}` : '—';
  }

  function openCreate() {
    setEditingId(null);
    setDraftTouched(false);
    setForm(emptyContractForm());
    setModalOpen(true);
  }

  function openEdit(c: Contract) {
    setEditingId(c.id);
    setDraftTouched(true);
    setForm({
      code: c.code,
      name: c.name,
      counterpartyType: c.counterpartyType === 'CORPORATE' ? 'CORPORATE' : 'AGENCY',
      agencyId: c.agencyId ?? '',
      companyId: c.companyId ?? '',
      ratePlanId: c.ratePlanId,
      validFrom: toDateInput(c.validFrom),
      validTo: toDateInput(c.validTo),
      commissionPercent:
        c.commissionPercent != null && c.commissionPercent !== ''
          ? String(c.commissionPercent)
          : '',
      commissionBasis: c.commissionBasis === 'NET' ? 'NET' : 'GROSS',
      depositRequired: Boolean(c.depositRequired),
      depositAmount:
        c.depositAmount != null && c.depositAmount !== '' ? String(c.depositAmount) : '',
      notes: c.notes ?? '',
      externalRef: c.externalRef ?? '',
      minStay: c.minStay != null ? String(c.minStay) : '',
      cta: Boolean(c.cta),
      ctd: Boolean(c.ctd),
    });
    setModalOpen(true);
  }

  function openAllotmentCreate(contract: Contract) {
    setAllotForm({
      ...emptyAllotmentForm(),
      validFrom: toDateInput(contract.validFrom),
      validTo: toDateInput(contract.validTo),
    });
    setAllotmentFormOpen(true);
  }

  function openAllotmentEdit(row: Allotment) {
    setAllotForm({
      id: row.id,
      roomTypeId: row.roomTypeId,
      validFrom: toDateInput(row.validFrom),
      validTo: toDateInput(row.validTo),
      nightlyQuota: String(row.nightlyQuota),
      releaseDays: String(row.releaseDays ?? 0),
    });
    setAllotmentFormOpen(true);
  }

  async function showUtilization(contractId: string) {
    const res = await fetch(`/api/admin/contracts/${contractId}?utilization=1`);
    const data = await res.json();
    if (res.ok) setUtilizationModal(data);
    else showApiError(data, tc('error'));
  }

  function validateForm(): boolean {
    if (!form.code.trim() || !form.name.trim()) {
      showApiError({ error: t('codeNameRequired') });
      return false;
    }
    if (!form.ratePlanId) {
      showApiError({ error: t('ratePlanRequired') });
      return false;
    }
    if (form.counterpartyType === 'AGENCY' && !form.agencyId) {
      showApiError({ error: t('agencyRequired') });
      return false;
    }
    if (form.counterpartyType === 'CORPORATE' && !form.companyId) {
      showApiError({ error: t('companyRequired') });
      return false;
    }
    return true;
  }

  function contractPayload(mode: 'create' | 'edit') {
    const base = {
      name: form.name,
      counterpartyType: form.counterpartyType,
      ratePlanId: form.ratePlanId,
      validFrom: form.validFrom,
      commissionPercent: form.commissionPercent ? Number(form.commissionPercent) : null,
      commissionBasis: form.commissionBasis,
      depositRequired: form.depositRequired,
      depositAmount:
        form.depositRequired && form.depositAmount ? Number(form.depositAmount) : null,
      notes: form.notes.trim() || null,
      externalRef: form.externalRef.trim() || null,
      minStay: form.minStay ? Number(form.minStay) : null,
      cta: form.cta,
      ctd: form.ctd,
    };
    if (mode === 'create') {
      return {
        ...base,
        code: form.code,
        agencyId: form.counterpartyType === 'AGENCY' ? form.agencyId : undefined,
        companyId: form.counterpartyType === 'CORPORATE' ? form.companyId : undefined,
        validTo: form.validTo || undefined,
        commissionPercent: form.commissionPercent
          ? Number(form.commissionPercent)
          : undefined,
        depositAmount:
          form.depositRequired && form.depositAmount
            ? Number(form.depositAmount)
            : undefined,
        notes: form.notes.trim() || undefined,
        externalRef: form.externalRef.trim() || undefined,
        minStay: form.minStay ? Number(form.minStay) : undefined,
        status: 'DRAFT' as const,
      };
    }
    return {
      ...base,
      agencyId: form.counterpartyType === 'AGENCY' ? form.agencyId : null,
      companyId: form.counterpartyType === 'CORPORATE' ? form.companyId : null,
      validTo: form.validTo || null,
    };
  }

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setBusy(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/admin/contracts/${editingId}` : '/api/admin/contracts',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contractPayload(isEdit ? 'edit' : 'create')),
        },
      );
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(isEdit ? t('updated') : t('created'));
      setModalOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    }
  }

  async function saveAllotment(e: React.FormEvent) {
    e.preventDefault();
    if (!managedLive) return;
    if (!allotForm.roomTypeId) {
      showApiError({ error: t('roomTypeRequired') });
      return;
    }
    if (!allotForm.nightlyQuota || Number(allotForm.nightlyQuota) < 1) {
      showApiError({ error: t('quotaRequired') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contracts/${managedLive.id}/allotments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: allotForm.id || undefined,
          roomTypeId: allotForm.roomTypeId,
          validFrom: allotForm.validFrom,
          validTo: allotForm.validTo,
          nightlyQuota: Number(allotForm.nightlyQuota),
          releaseDays: Number(allotForm.releaseDays) || 0,
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('allotmentSaved'));
      setAllotmentFormOpen(false);
      setAllotForm(emptyAllotmentForm());
      await load();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    }
  }

  async function deleteAllotment(allotmentId: string) {
    if (!managedLive) return;
    if (!window.confirm(t('confirmDeleteAllotment'))) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/contracts/${managedLive.id}/allotments?allotmentId=${encodeURIComponent(allotmentId)}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('allotmentDeleted'));
      await load();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    }
  }

  async function activate(c: Contract) {
    if (c.allotments.length === 0 && !window.confirm(t('activateWithoutAllotments'))) return;
    const res = await fetch(`/api/admin/contracts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (res.ok) {
      showSuccess(t('activated'));
      await load();
    } else {
      showApiError(await res.json().catch(() => ({})), tc('error'));
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('create')}
          </button>
        }
      />
      <p className="mb-4 text-xs text-[#7F8C8D]">{t('productNote')}</p>

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setFilterType('ALL');
          setFilterStatus('ALL');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('filterType')}
          value={filterType}
          onChange={(v) => {
            const next = catalogStr(v);
            setFilterType(next === 'AGENCY' || next === 'CORPORATE' ? next : 'ALL');
          }}
          options={[
            { value: 'ALL', label: t('filterAll') },
            { value: 'AGENCY', label: t('typeAgency') },
            { value: 'CORPORATE', label: t('typeCorporate') },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('filterStatus')}
          value={filterStatus}
          onChange={(v) => setFilterStatus(catalogStr(v) || 'ALL')}
          options={[
            { value: 'ALL', label: t('filterAll') },
            { value: 'DRAFT', label: t('statusDraft') },
            { value: 'ACTIVE', label: t('statusActive') },
            { value: 'EXPIRED', label: t('statusExpired') },
            { value: 'CANCELLED', label: t('statusCancelled') },
          ]}
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('counterparty')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ratePlan')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('validity')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('commissionPercent')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('commissionBasis')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('allotments')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((c) => (
                <tr key={c.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{c.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <span className="block text-[11px] text-[#7F8C8D]">
                      {c.counterpartyType === 'CORPORATE' ? t('typeCorporate') : t('typeAgency')}
                    </span>
                    {counterpartyLabel(c)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.ratePlan.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {bakuDateDisplay(c.validFrom)} —{' '}
                    {c.validTo ? bakuDateDisplay(c.validTo) : '∞'}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {c.commissionPercent != null && c.commissionPercent !== ''
                      ? String(c.commissionPercent)
                      : '—'}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {c.commissionBasis === 'NET' ? t('basisNet') : t('basisGross')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.allotments.length}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{statusLabel(c.status)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => openEdit(c)}
                      >
                        {tc('edit')}
                      </button>
                      {c.status === 'DRAFT' ? (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => void activate(c)}
                        >
                          {t('activate')}
                        </button>
                      ) : null}
                      <EraMenu
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className={GHOST_BUTTON_CLASS}
                            aria-label={t('moreActions')}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </button>
                        }
                      >
                        <EraMenuItem onSelect={() => void showUtilization(c.id)}>
                          {t('utilization')}
                        </EraMenuItem>
                        <EraMenuItem onSelect={() => setManageContract(c)}>
                          {t('manageAllotments')}
                        </EraMenuItem>
                        <EraMenuItem
                          onSelect={() => {
                            window.location.href = `/distribution/allotment-blocks?contractId=${encodeURIComponent(c.id)}`;
                          }}
                        >
                          {t('createBlock')}
                        </EraMenuItem>
                      </EraMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredContracts.length === 0 && (
                <tr>
                  <td colSpan={10} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
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
        title={editingId ? t('edit') : t('create')}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        footer={
          <EraModalFooter
            formId="contract-form"
            onCancel={() => {
              setModalOpen(false);
              setEditingId(null);
            }}
            busy={busy}
            submitLabel={editingId ? tc('save') : t('create')}
          />
        }
      >
        <form id="contract-form" onSubmit={saveContract} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('counterpartyType')}
            value={form.counterpartyType}
            onChange={(v) => {
              const next = catalogStr(v) === 'CORPORATE' ? 'CORPORATE' : 'AGENCY';
              setForm((f) => ({
                ...f,
                counterpartyType: next,
                agencyId: next === 'CORPORATE' ? '' : f.agencyId,
                companyId: next === 'AGENCY' ? '' : f.companyId,
              }));
              applyDraftCodeName({
                counterpartyType: next,
                agencyId: next === 'CORPORATE' ? '' : form.agencyId,
                companyId: next === 'AGENCY' ? '' : form.companyId,
              });
            }}
            options={[
              { value: 'AGENCY', label: t('typeAgency') },
              { value: 'CORPORATE', label: t('typeCorporate') },
            ]}
          />

          {form.counterpartyType === 'AGENCY' ? (
            <CatalogField
              kind="SEARCHABLE"
              label={t('agency')}
              value={form.agencyId}
              onChange={(v) => {
                const agencyId = catalogStr(v);
                setForm((f) => ({ ...f, agencyId }));
                applyDraftCodeName({ agencyId });
              }}
              options={agencyOptions}
              emptyLabel={t('selectAgency')}
              required
            />
          ) : (
            <CatalogField
              kind="SEARCHABLE"
              label={t('company')}
              value={form.companyId}
              onChange={(v) => {
                const companyId = catalogStr(v);
                setForm((f) => ({ ...f, companyId }));
                applyDraftCodeName({ companyId });
              }}
              options={companyOptions}
              emptyLabel={t('selectCompany')}
              required
            />
          )}

          <CatalogField
            kind="SEARCHABLE"
            label={t('ratePlan')}
            value={form.ratePlanId}
            onChange={(v) => {
              const ratePlanId = catalogStr(v);
              setForm((f) => ({ ...f, ratePlanId }));
              applyDraftCodeName({ ratePlanId });
            }}
            options={ratePlanOptions}
            emptyLabel={t('selectRatePlan')}
            required
          />

          <FieldRow cols={2}>
            <DatePicker
              label={t('validFrom')}
              value={form.validFrom}
              onChange={(v) => setForm((f) => ({ ...f, validFrom: v }))}
              placeholder={tc('datePlaceholder')}
              preset="date"
              required
            />
            <DatePicker
              label={t('validTo')}
              value={form.validTo}
              onChange={(v) => setForm((f) => ({ ...f, validTo: v }))}
              placeholder={tc('datePlaceholder')}
              preset="date"
            />
          </FieldRow>
          <p className="text-xs text-[#7F8C8D]">{t('seasonHint')}</p>

          <FieldRow cols={2}>
            <Field
              label={t('commissionPercent')}
              preset="count"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.commissionPercent}
              onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('commissionBasis')}
              value={form.commissionBasis}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  commissionBasis: catalogStr(v) === 'NET' ? 'NET' : 'GROSS',
                }))
              }
              options={[
                { value: 'GROSS', label: t('basisGross') },
                { value: 'NET', label: t('basisNet') },
              ]}
            />
          </FieldRow>
          <p className="text-xs text-[#7F8C8D]">
            {form.commissionBasis === 'NET' ? t('basisNetHint') : t('basisGrossHint')}
          </p>

          <FieldRow cols={2}>
            <Field
              label={t('code')}
              preset="code"
              value={form.code}
              onChange={(e) => {
                setDraftTouched(true);
                setForm((f) => ({ ...f, code: e.target.value }));
              }}
              required
              disabled={Boolean(editingId)}
            />
            <Field
              label={t('name')}
              preset="shortText"
              value={form.name}
              onChange={(e) => {
                setDraftTouched(true);
                setForm((f) => ({ ...f, name: e.target.value }));
              }}
              required
            />
          </FieldRow>

          <p className="m-0 text-[12px] font-medium text-[#34495E]">{t('conditions')}</p>
          <Field
            label={t('minStay')}
            preset="count"
            type="number"
            min={1}
            value={form.minStay}
            onChange={(e) => setForm((f) => ({ ...f, minStay: e.target.value }))}
          />

          <FieldRow cols={2}>
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={form.cta}
                onChange={(e) => setForm((f) => ({ ...f, cta: e.target.checked }))}
              />
              {t('cta')}
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={form.ctd}
                onChange={(e) => setForm((f) => ({ ...f, ctd: e.target.checked }))}
              />
              {t('ctd')}
            </label>
          </FieldRow>

          <Field
            label={t('externalRef')}
            preset="shortText"
            value={form.externalRef}
            onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={form.depositRequired}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  depositRequired: e.target.checked,
                  depositAmount: e.target.checked ? f.depositAmount : '',
                }))
              }
            />
            {t('depositRequired')}
          </label>
          {form.depositRequired && (
            <Field
              label={t('depositAmount')}
              preset="count"
              type="number"
              min={0}
              step="0.01"
              value={form.depositAmount}
              onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))}
            />
          )}

          <Field
            label={t('notes')}
            preset="longText"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {!editingId && <p className="text-xs text-[#7F8C8D]">{t('draftHint')}</p>}
        </form>
      </EraModal>

      <EraModal
        open={!!managedLive}
        title={t('manageAllotmentsTitle', { code: managedLive?.code ?? '' })}
        onClose={() => {
          setManageContract(null);
          setAllotmentFormOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setManageContract(null);
                setAllotmentFormOpen(false);
              }}
            >
              {tc('close')}
            </button>
            {managedLive && !allotmentFormOpen && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => openAllotmentCreate(managedLive)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t('addAllotment')}
              </button>
            )}
          </div>
        }
      >
        {managedLive && (
          <div className="space-y-4">
            <p className="text-xs text-[#7F8C8D]">
              {t('allotmentSeasonNote', {
                from: bakuDateDisplay(managedLive.validFrom),
                to: managedLive.validTo
                  ? bakuDateDisplay(managedLive.validTo)
                  : '∞',
              })}
            </p>

            {!allotmentFormOpen && (
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('validity')}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('nightlyQuota')}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('releaseDays')}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managedLive.allotments.map((a) => (
                      <tr key={a.id} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {a.roomType.code} — {a.roomType.name}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {bakuDateDisplay(a.validFrom)} —{' '}
                          {bakuDateDisplay(a.validTo)}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{a.nightlyQuota}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{a.releaseDays ?? 0}</td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              onClick={() => openAllotmentEdit(a)}
                            >
                              {tc('edit')}
                            </button>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void deleteAllotment(a.id)}
                            >
                              {tc('delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {managedLive.allotments.length === 0 && (
                      <tr>
                        <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                          {t('allotmentsEmpty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {allotmentFormOpen && (
              <form id="allotment-form" onSubmit={saveAllotment} className={FORM_STACK_CLASS}>
                <p className="text-sm font-medium text-[#2C3E50]">
                  {allotForm.id ? t('editAllotment') : t('addAllotment')}
                </p>
                <CatalogField
                  kind="SEARCHABLE"
                  label={t('roomType')}
                  value={allotForm.roomTypeId}
                  onChange={(v) => setAllotForm((f) => ({ ...f, roomTypeId: catalogStr(v) }))}
                  options={roomTypeOptions}
                  emptyLabel={t('selectRoomType')}
                  required
                />
                <FieldRow cols={2}>
                  <DatePicker
                    label={t('validFrom')}
                    value={allotForm.validFrom}
                    onChange={(v) => setAllotForm((f) => ({ ...f, validFrom: v }))}
                    placeholder={tc('datePlaceholder')}
                    preset="date"
                    required
                  />
                  <DatePicker
                    label={t('validTo')}
                    value={allotForm.validTo}
                    onChange={(v) => setAllotForm((f) => ({ ...f, validTo: v }))}
                    placeholder={tc('datePlaceholder')}
                    preset="date"
                    required
                  />
                </FieldRow>
                <p className="text-xs text-[#7F8C8D]">{t('allotmentDateHint')}</p>
                <FieldRow cols={2}>
                  <Field
                    label={t('nightlyQuota')}
                    preset="count"
                    type="number"
                    min={1}
                    value={allotForm.nightlyQuota}
                    onChange={(e) => setAllotForm((f) => ({ ...f, nightlyQuota: e.target.value }))}
                    required
                  />
                  <Field
                    label={t('releaseDays')}
                    preset="count"
                    type="number"
                    min={0}
                    value={allotForm.releaseDays}
                    onChange={(e) => setAllotForm((f) => ({ ...f, releaseDays: e.target.value }))}
                    hint={t('releaseDaysHint')}
                  />
                </FieldRow>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => {
                      setAllotmentFormOpen(false);
                      setAllotForm(emptyAllotmentForm());
                    }}
                  >
                    {tc('cancel')}
                  </button>
                  <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                    {tc('save')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </EraModal>

      <EraModal
        open={!!utilizationModal}
        title={t('utilizationTitle', { code: utilizationModal?.code ?? '' })}
        onClose={() => setUtilizationModal(null)}
        footer={
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setUtilizationModal(null)}
          >
            {tc('close')}
          </button>
        }
      >
        {utilizationModal && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[#7F8C8D]">{t('reservationCount')}</dt>
            <dd>{utilizationModal.reservationCount}</dd>
            <dt className="text-[#7F8C8D]">{t('allotmentNights')}</dt>
            <dd>{utilizationModal.allotmentNights}</dd>
            <dt className="text-[#7F8C8D]">{t('consumedNights')}</dt>
            <dd>{utilizationModal.consumedNights}</dd>
            <dt className="text-[#7F8C8D]">{t('utilizationPercent')}</dt>
            <dd>
              {utilizationModal.utilizationPercent != null
                ? `${utilizationModal.utilizationPercent}%`
                : '—'}
            </dd>
            <dt className="text-[#7F8C8D]">{t('totalRevenue')}</dt>
            <dd>{utilizationModal.totalRevenue} AZN</dd>
          </dl>
        )}
      </EraModal>
    </>
  );
}
