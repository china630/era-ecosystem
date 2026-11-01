'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  FieldGroupBox,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import {
  bookingSourceKind,
  contractCounterpartyType,
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
  commissionPercent?: number | string | null;
  commissionBasis?: 'GROSS' | 'NET' | string | null;
  ratePlanId?: string | null;
};

export type RoomPayerValue = 'GUEST' | 'AGENCY' | 'COMPANY';
export type CommissionBasisValue = 'GROSS' | 'NET';

/** Source, agency, company + room payer / contract (Travel agent / Company group). */
export function CommercialPartyStrip({
  sourceId,
  agencyId,
  companyId,
  salesContractId,
  roomPayer,
  commissionBasis,
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
  onRoomPayer,
  onCommissionBasis,
  onAgencyCreated,
  onCompanyCreated,
  walkInProfiles = [],
  walkInProfileCode = '',
  onWalkInProfile,
}: {
  sourceId: string;
  agencyId: string;
  companyId: string;
  salesContractId: string;
  roomPayer: RoomPayerValue;
  commissionBasis: CommissionBasisValue;
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
  onRoomPayer: (value: RoomPayerValue) => void;
  onCommissionBasis: (value: CommissionBasisValue) => void;
  onAgencyCreated: (row: AgencyOption) => void;
  onCompanyCreated: (row: AgencyOption) => void;
  walkInProfiles?: Array<{ code: string; label: string }>;
  walkInProfileCode?: string;
  onWalkInProfile?: (code: string) => void;
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
  const payerTouched = useRef(false);

  const selectedSource = sources.find((s) => s.id === sourceId);
  const sourceKind = bookingSourceKind(selectedSource?.code);
  const agencyPickerLocked = sourceKind === 'WEB';
  const agencyOptions = useMemo(() => {
    const scoped =
      sourceKind === 'AGENCY'
        ? agencies.filter((a) => !a.isOta && !a.isWalkIn)
        : sourceKind === 'BOOKING'
          ? agencies.filter((a) => a.isOta)
          : agencies.filter((a) => !a.isWalkIn);
    if (!agencyId || scoped.some((a) => a.id === agencyId)) return scoped;
    const hit = agencies.find((a) => a.id === agencyId);
    return hit ? [hit, ...scoped] : scoped;
  }, [agencies, sourceKind, agencyId]);
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
      : sourceKind === 'WALKIN'
        ? t('walkInProfile')
        : t('agency');
  const canQuickAddAgency =
    sourceKind === 'AGENCY' || sourceKind === 'CORPORATE' || sourceKind === 'OTHER';
  const knownAgencyId = agencies.some((a) => a.id === agencyId) ? agencyId : '';
  const knownCompanyId = companies.some((c) => c.id === companyId) ? companyId : '';
  const showAgencyPlus = canQuickAddAgency && !agencyPickerLocked;
  const contractRequired = roomPayer === 'AGENCY' || roomPayer === 'COMPANY';
  const showPayerRow = Boolean(knownAgencyId || knownCompanyId);

  /** When both party profiles are set, Müqavilə follows the active room payer (agency wins only if payer=AGENCY). */
  const visibleContracts = useMemo(() => {
    const matched = contractsForSource(contracts, { sourceKind, agencyId, companyId });
    const byPayer =
      roomPayer === 'AGENCY' && knownAgencyId
        ? matched.filter((c) => contractCounterpartyType(c) === 'AGENCY')
        : roomPayer === 'COMPANY' && knownCompanyId
          ? matched.filter((c) => contractCounterpartyType(c) === 'CORPORATE')
          : matched;
    const day = (checkIn ?? '').slice(0, 10);
    if (!day) return byPayer;
    return byPayer.filter((c) => {
      if (c.id === salesContractId) return true;
      if (!c.validFrom) return true;
      const from = String(c.validFrom).slice(0, 10);
      const to = c.validTo ? String(c.validTo).slice(0, 10) : '';
      if (from > day) return false;
      if (to && to < day) return false;
      return true;
    });
  }, [
    contracts,
    sourceKind,
    agencyId,
    companyId,
    checkIn,
    salesContractId,
    roomPayer,
    knownAgencyId,
    knownCompanyId,
  ]);

  useEffect(() => {
    if (payerTouched.current) return;
    if (knownCompanyId && roomPayer !== 'COMPANY') onRoomPayer('COMPANY');
    else if (!knownCompanyId && knownAgencyId && roomPayer === 'COMPANY') onRoomPayer('GUEST');
    else if (!knownCompanyId && !knownAgencyId && roomPayer !== 'GUEST') onRoomPayer('GUEST');
  }, [knownAgencyId, knownCompanyId, roomPayer, onRoomPayer]);

  useEffect(() => {
    if (!contractRequired) return;
    if (salesContractId) return;
    if (visibleContracts.length !== 1) return;
    onContract(visibleContracts[0]!.id);
  }, [contractRequired, salesContractId, visibleContracts, onContract]);

  useEffect(() => {
    if (!salesContractId) return;
    if (roomPayer === 'GUEST') {
      onContract('');
      return;
    }
    const row = contracts.find((c) => c.id === salesContractId);
    if (!row) return;
    const kind = contractCounterpartyType(row);
    if (roomPayer === 'AGENCY' && kind !== 'AGENCY') onContract('');
    if (roomPayer === 'COMPANY' && kind !== 'CORPORATE') onContract('');
  }, [roomPayer, salesContractId, contracts, onContract]);

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

  const selectedContract = visibleContracts.find((c) => c.id === salesContractId);
  const agencyLabel = agencies.find((a) => a.id === knownAgencyId)?.label ?? '';
  const companyLabel = companies.find((c) => c.id === knownCompanyId)?.label ?? '';
  const commissionPct =
    selectedContract?.commissionPercent != null && selectedContract.commissionPercent !== ''
      ? Number(selectedContract.commissionPercent)
      : null;
  const payerSentence =
    roomPayer === 'AGENCY'
      ? t('roomPaidByAgency', { name: agencyLabel || '—' })
      : roomPayer === 'COMPANY'
        ? t('roomPaidByCompany', { name: companyLabel || '—' })
        : t('roomPaidByGuest');
  const basisSentence = knownAgencyId
    ? commissionBasis === 'NET'
      ? selectedContract
        ? t('basisNetWithContract', { contract: selectedContract.label })
        : t('basisNetOnly')
      : commissionPct != null && !Number.isNaN(commissionPct)
        ? t('basisGrossWithPct', { pct: commissionPct })
        : t('basisGrossOnly')
    : '';
  const billingSentence = [payerSentence, basisSentence].filter(Boolean).join(' · ');

  const payerOptions = [
    { value: 'GUEST', label: t('roomPayerGuest') },
    ...(knownAgencyId ? [{ value: 'AGENCY', label: t('roomPayerAgency') }] : []),
    ...(knownCompanyId ? [{ value: 'COMPANY', label: t('roomPayerCompany') }] : []),
  ];

  return (
    <FieldGroupBox title={t('travelAgentCompany')}>
      <div className="space-y-2" data-testid="commercial-party-strip">
        <div className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-3">
          <CatalogField
            kind="SEARCHABLE"
            label={t('source')}
            value={sourceId}
            onChange={(v) => onSource(Array.isArray(v) ? (v[0] ?? '') : v)}
            options={sourceOptions.map((s) => ({
              value: s.id,
              label: sourceKindLabel(t, bookingSourceKind(s.code), s.label),
            }))}
            disabled={disabled}
          />
          <div className="min-w-0 space-y-px">
            <div className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
                <CatalogField
                  kind="SEARCHABLE"
                  label={agencyFieldLabel}
                  value={
                    sourceKind === 'WALKIN'
                      ? walkInProfileCode
                      : agencyPickerLocked
                        ? ''
                        : knownAgencyId
                  }
                  onChange={(v) => {
                    const next = Array.isArray(v) ? (v[0] ?? '') : v;
                    if (sourceKind === 'WALKIN') onWalkInProfile?.(next);
                    else onAgency(next);
                  }}
                  options={
                    sourceKind === 'WALKIN'
                      ? [
                          ...walkInProfiles.map((p) => ({ value: p.code, label: p.label })),
                          ...(walkInProfileCode &&
                          !walkInProfiles.some((p) => p.code === walkInProfileCode)
                            ? [{ value: walkInProfileCode, label: walkInProfileCode }]
                            : []),
                        ]
                      : agencyPickerLocked
                        ? []
                        : agencyOptions.map((a) => ({ value: a.id, label: a.label }))
                  }
                  disabled={disabled || agencyPickerLocked}
                  emptyLabel={agencyPickerLocked ? t('individual') : tc('select')}
                />
              </div>
              {showAgencyPlus ? (
                <LookupPlus
                  label={t('quickAddAgency')}
                  pressed={agencyOpen}
                  disabled={disabled || busy}
                  onClick={() => {
                    setAgencyOpen((v) => !v);
                    setCompanyOpen(false);
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="min-w-0 space-y-px">
            <div className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
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
              <LookupPlus
                label={t('quickAddCompany')}
                pressed={companyOpen}
                disabled={disabled || busy}
                onClick={() => {
                  setCompanyOpen((v) => !v);
                  setAgencyOpen(false);
                }}
              />
            </div>
          </div>
        </div>
        {agencyOpen && showAgencyPlus ? (
          <div className="flex items-end gap-1.5">
            <Field
              label={t('quickAgencyName')}
              preset="shortText"
              className="min-w-0 flex-1"
              value={agencyName}
              disabled={disabled || busy}
              onChange={(e) => setAgencyName(e.target.value)}
            />
            <Field
              label={t('quickAgencyPhone')}
              preset="phone"
              className="w-[9rem] shrink-0"
              value={agencyPhone}
              disabled={disabled || busy}
              onChange={(e) => setAgencyPhone(e.target.value)}
            />
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} mb-px shrink-0`}
              disabled={disabled || busy}
              onClick={() => {
                setAgencyName('');
                setAgencyPhone('');
                setAgencyOpen(false);
              }}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} mb-px shrink-0`}
              disabled={disabled || busy}
              onClick={() => void createAgency()}
            >
              {tc('save')}
            </button>
          </div>
        ) : null}
        {companyOpen ? (
          <div className="flex items-end gap-1.5">
            <Field
              label={t('quickCompanyName')}
              preset="shortText"
              className="min-w-0 flex-1"
              value={companyName}
              disabled={disabled || busy}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Field
              label={t('quickCompanyVoen')}
              preset="voen"
              className="w-[9rem] shrink-0"
              value={companyVoen}
              disabled={disabled || busy}
              onChange={(e) => setCompanyVoen(e.target.value)}
            />
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} mb-px shrink-0`}
              disabled={disabled || busy}
              onClick={() => {
                setCompanyName('');
                setCompanyVoen('');
                setCompanyOpen(false);
              }}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} mb-px shrink-0`}
              disabled={disabled || busy}
              onClick={() => void createCompany()}
            >
              {tc('save')}
            </button>
          </div>
        ) : null}
        {showPayerRow ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <CatalogField
                  kind="OPS_HOT"
                  label={t('roomPayer')}
                  value={roomPayer}
                  onChange={(v) => {
                    payerTouched.current = true;
                    const next = Array.isArray(v) ? (v[0] ?? '') : v;
                    if (next === 'AGENCY' || next === 'COMPANY' || next === 'GUEST') {
                      onRoomPayer(next);
                    }
                  }}
                  options={payerOptions}
                  disabled={disabled}
                />
                {knownAgencyId ? (
                  <CatalogField
                    kind="OPS_HOT"
                    label={t('commissionBasis')}
                    value={commissionBasis}
                    onChange={(v) => {
                      const next = Array.isArray(v) ? (v[0] ?? '') : v;
                      onCommissionBasis(next === 'NET' ? 'NET' : 'GROSS');
                    }}
                    options={[
                      { value: 'GROSS', label: t('basisGross') },
                      { value: 'NET', label: t('basisNet') },
                    ]}
                    disabled={disabled}
                  />
                ) : null}
              </div>
              {contractRequired ? (
                <div className="min-w-0 space-y-1">
                  <CatalogField
                    kind="ENTITY_REF"
                    label={`${t('stayContract')} (${t('contractRequiredMark')})`}
                    value={salesContractId}
                    onChange={(v) => onContract(Array.isArray(v) ? (v[0] ?? '') : v)}
                    options={visibleContracts.map((c) => ({ value: c.id, label: c.label }))}
                    emptyLabel="—"
                    disabled={disabled || visibleContracts.length === 0}
                  />
                  {visibleContracts.length === 0 ? (
                    <p className="m-0 text-[12px] text-rose-800" data-testid="contract-create-hint">
                      {t('contractCreateHint')}{' '}
                      <Link href="/distribution/contracts" className="underline">
                        {t('openB2bContracts')}
                      </Link>
                    </p>
                  ) : null}
                  {!salesContractId && visibleContracts.length > 0 ? (
                    <p className="m-0 text-[12px] text-rose-800" data-testid="contract-required-hint">
                      {t('contractRequiredHint')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {billingSentence ? (
              <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`} data-testid="room-payer-sentence">
                {billingSentence}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </FieldGroupBox>
  );
}

function LookupPlus({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[18px] leading-none shadow-sm transition disabled:opacity-40 ${
        pressed
          ? 'border-[#2C3E50] bg-[#2C3E50] text-white'
          : 'border-[#D5DADF] bg-white text-[#34495E] hover:bg-[#F4F6F7]'
      }`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      +
    </button>
  );
}
