'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  FieldRow,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import {
  bookingSourceKind,
  contractsForSource,
  isManualFoSourceKind,
  sourceKindLabel,
  type SalesContractPick,
} from '@/lib/booking-source-kind';
import type { AgencyOption, SourceOption } from './types';

type ContractOption = SalesContractPick & {
  label: string;
  code: string;
  validFrom?: string | null;
  validTo?: string | null;
};

/** Source, agency, and company above the stay dates. One contract under that row. */
export function CommercialPartyStrip({
  sourceId,
  agencyId,
  companyId,
  salesContractId,
  contractRef,
  checkIn,
  sources,
  agencies,
  companies,
  contracts,
  disabled,
  onSource,
  onAgency,
  onCompany,
  onContract,
  onContractRef,
  onAgencyCreated,
  onCompanyCreated,
}: {
  sourceId: string;
  agencyId: string;
  companyId: string;
  salesContractId: string;
  contractRef: string;
  checkIn?: string;
  sources: SourceOption[];
  agencies: AgencyOption[];
  companies: AgencyOption[];
  contracts: ContractOption[];
  disabled?: boolean;
  onSource: (id: string) => void;
  onAgency: (id: string) => void;
  onCompany: (id: string) => void;
  onContract: (id: string) => void;
  onContractRef: (value: string) => void;
  onAgencyCreated: (row: AgencyOption) => void;
  onCompanyCreated: (row: AgencyOption) => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyVoen, setCompanyVoen] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedSource = sources.find((s) => s.id === sourceId);
  const sourceKind = bookingSourceKind(selectedSource?.code);
  const walkInAgencies = useMemo(() => agencies.filter((a) => a.isWalkIn), [agencies]);
  const agencyPickerLocked =
    sourceKind === 'WEB' || (sourceKind === 'WALKIN' && walkInAgencies.length === 0);
  const agencyOptions = useMemo(() => {
    const scoped =
      sourceKind === 'AGENCY'
        ? agencies.filter((a) => !a.isOta && !a.isWalkIn)
        : sourceKind === 'BOOKING'
          ? agencies.filter((a) => a.isOta)
          : sourceKind === 'WALKIN'
            ? walkInAgencies
            : agencies.filter((a) => !a.isWalkIn);
    if (!agencyId || scoped.some((a) => a.id === agencyId)) return scoped;
    const hit = agencies.find((a) => a.id === agencyId);
    return hit ? [hit, ...scoped] : scoped;
  }, [agencies, walkInAgencies, sourceKind, agencyId]);
  const sourceOptions = useMemo(
    () =>
      sources.filter(
        (s) => isManualFoSourceKind(bookingSourceKind(s.code)) || s.id === sourceId,
      ),
    [sources, sourceId],
  );
  const agencyFieldLabel =
    sourceKind === 'BOOKING'
      ? t('otaChannel')
      : sourceKind === 'WALKIN' && !agencyPickerLocked
        ? t('walkInProfile')
        : t('agency');
  const canQuickAddAgency =
    sourceKind === 'AGENCY' || sourceKind === 'CORPORATE' || sourceKind === 'OTHER';
  const visibleContracts = useMemo(() => {
    const matched = contractsForSource(contracts, { sourceKind, agencyId, companyId });
    const day = (checkIn ?? '').slice(0, 10);
    if (!day) return matched;
    return matched.filter((c) => {
      if (c.id === salesContractId) return true;
      if (!c.validFrom) return true;
      const from = String(c.validFrom).slice(0, 10);
      const to = c.validTo ? String(c.validTo).slice(0, 10) : '';
      if (from > day) return false;
      if (to && to < day) return false;
      return true;
    });
  }, [contracts, sourceKind, agencyId, companyId, checkIn, salesContractId]);
  const knownAgencyId = agencies.some((a) => a.id === agencyId) ? agencyId : '';
  const knownCompanyId = companies.some((c) => c.id === companyId) ? companyId : '';

  async function createAgency() {
    if (!agencyName.trim() || agencyPhone.trim().length < 5) {
      showApiError({ error: t('quickAgencyRequired') }, tc('failed'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/fo/quick-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'AGENCY',
          name: agencyName.trim(),
          phone: agencyPhone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      const row: AgencyOption = {
        id: String(json.id),
        code: String(json.code ?? ''),
        label: String(json.name ?? agencyName.trim()),
        isOta: false,
        isWalkIn: false,
      };
      onAgencyCreated(row);
      onAgency(row.id);
      setAgencyName('');
      setAgencyPhone('');
      setAgencyOpen(false);
      showSuccess(t('quickProfileSaved'));
    } finally {
      setBusy(false);
    }
  }

  async function createCompany() {
    if (!companyName.trim() || !/^\d{10}$/.test(companyVoen.trim())) {
      showApiError({ error: t('quickCompanyRequired') }, tc('failed'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/fo/quick-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'COMPANY',
          name: companyName.trim(),
          voen: companyVoen.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      const row: AgencyOption = {
        id: String(json.id),
        code: String(json.code ?? ''),
        label: String(json.name ?? companyName.trim()),
        isOta: false,
        isWalkIn: false,
      };
      onCompanyCreated(row);
      onCompany(row.id);
      setCompanyName('');
      setCompanyVoen('');
      setCompanyOpen(false);
      showSuccess(t('quickProfileSaved'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="commercial-party-strip">
      <div className="grid grid-cols-1 items-end gap-1.5 sm:grid-cols-3">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('source')}
          value={sourceId}
          onChange={(v) => onSource(Array.isArray(v) ? (v[0] ?? '') : v)}
          options={sourceOptions.map((s) => ({
            value: s.id,
            label: sourceKindLabel(t, bookingSourceKind(s.code), s.label),
          }))}
          disabled={disabled}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={agencyFieldLabel}
          value={agencyPickerLocked ? '' : knownAgencyId}
          onChange={(v) => onAgency(Array.isArray(v) ? (v[0] ?? '') : v)}
          options={
            agencyPickerLocked ? [] : agencyOptions.map((a) => ({ value: a.id, label: a.label }))
          }
          disabled={disabled || agencyPickerLocked}
          emptyLabel={agencyPickerLocked || sourceKind === 'WALKIN' ? t('individual') : tc('select')}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t('company')}
          value={knownCompanyId}
          onChange={(v) => onCompany(Array.isArray(v) ? (v[0] ?? '') : v)}
          options={companies.map((c) => ({ value: c.id, label: c.label }))}
          disabled={disabled}
          emptyLabel={tc('select')}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {canQuickAddAgency ? (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={disabled || busy}
            onClick={() => setAgencyOpen((v) => !v)}
          >
            {t('quickAddAgency')}
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={disabled || busy}
          onClick={() => setCompanyOpen((v) => !v)}
        >
          {t('quickAddCompany')}
        </button>
      </div>
      {agencyOpen && canQuickAddAgency ? (
        <FieldRow cols={3}>
          <Field
            label={t('quickAgencyName')}
            preset="shortText"
            value={agencyName}
            disabled={disabled || busy}
            onChange={(e) => setAgencyName(e.target.value)}
          />
          <Field
            label={t('quickAgencyPhone')}
            preset="phone"
            value={agencyPhone}
            disabled={disabled || busy}
            onChange={(e) => setAgencyPhone(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={disabled || busy}
              onClick={() => void createAgency()}
            >
              {tc('save')}
            </button>
          </div>
        </FieldRow>
      ) : null}
      {companyOpen ? (
        <FieldRow cols={3}>
          <Field
            label={t('quickCompanyName')}
            preset="shortText"
            value={companyName}
            disabled={disabled || busy}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <Field
            label={t('quickCompanyVoen')}
            preset="code"
            value={companyVoen}
            disabled={disabled || busy}
            onChange={(e) => setCompanyVoen(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={disabled || busy}
              onClick={() => void createCompany()}
            >
              {tc('save')}
            </button>
          </div>
        </FieldRow>
      ) : null}
      <FieldRow cols={2}>
        <CatalogField
          kind="ENTITY_REF"
          label={t('stayContract')}
          value={salesContractId}
          onChange={(v) => onContract(Array.isArray(v) ? (v[0] ?? '') : v)}
          options={visibleContracts.map((c) => ({ value: c.id, label: c.label }))}
          emptyLabel="—"
          disabled={disabled || visibleContracts.length === 0}
        />
        <Field
          label={t('contractRef')}
          preset="code"
          value={contractRef}
          disabled={disabled}
          onChange={(e) => onContractRef(e.target.value)}
        />
      </FieldRow>
    </div>
  );
}
