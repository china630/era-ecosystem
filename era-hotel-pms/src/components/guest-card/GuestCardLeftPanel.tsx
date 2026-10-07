'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  Field,
  FieldPanel,
  FieldRow,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  NATIONALITY_OPTIONS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';
import { buildMdmPersonLookupBody } from '@/lib/mdm-person-lookup-body';

const GUEST_LOOKUP_KINDS = [
  'TITLE',
  'GENDER',
  'VIP_TYPE',
  'LOYALTY_TIER',
  'VISA_TYPE',
  'MARITAL_STATUS',
  'VERIFICATION_STATUS',
] as const;

function maskPersonId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

type MdmProfile = {
  identifiers: Array<{ type: string; maskedValue: string; isPrimary: boolean }>;
  accessDenied?: boolean;
};

export function GuestCardLeftPanel({
  fullName,
  firstName,
  lastName,
  middleName = '',
  title,
  sex,
  nationality,
  birthDate = '',
  birthPlace = '',
  phone = '',
  email = '',
  vipType,
  loyaltyTier = '',
  verificationStatus = '',
  phoneVerified = false,
  emailVerified = false,
  voen = '',
  visaType = '',
  visaNumber = '',
  visaExpiry = '',
  registrationNumber = '',
  vehiclePlate = '',
  occupation = '',
  maritalStatus = '',
  parentFatherName = '',
  parentMotherName = '',
  marriageDate = '',
  bonusPercent = '',
  primaryDocument = '',
  transientIdentity = { nationalIdFin: '', passportNumber: '' },
  mdmProfile = null,
  profileLoading,
  guestId = null,
  globalPersonId = null,
  allergenCount,
  onChange,
  onTransientChange = () => {},
  onVerified = () => {},
  onGlobalPersonIdChange = () => {},
  onReload,
  locked = false,
}: {
  fullName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  title: string;
  sex: string;
  nationality: string;
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  email?: string;
  vipType: string;
  loyaltyTier?: string;
  verificationStatus?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  voen?: string;
  visaType?: string;
  visaNumber?: string;
  visaExpiry?: string;
  registrationNumber?: string;
  vehiclePlate?: string;
  occupation?: string;
  maritalStatus?: string;
  parentFatherName?: string;
  parentMotherName?: string;
  marriageDate?: string;
  bonusPercent?: string;
  /** Read-only label of the primary document row (type + number). */
  primaryDocument?: string;
  transientIdentity?: { nationalIdFin: string; passportNumber: string };
  mdmProfile?: MdmProfile | null;
  profileLoading?: boolean;
  guestId?: string | null;
  globalPersonId?: string | null;
  allergenCount?: number;
  onChange: (patch: Record<string, string | boolean>) => void;
  onTransientChange?: (key: 'nationalIdFin' | 'passportNumber', value: string) => void;
  onVerified?: (key: 'phoneVerified' | 'emailVerified', value: boolean) => void;
  onGlobalPersonIdChange?: (id: string | null) => void;
  onReload?: () => void;
  locked?: boolean;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeFin, setMergeFin] = useState('');
  const { byKind } = useHotelLookupOptions([...GUEST_LOOKUP_KINDS]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: e.target.value });
  const setCatalog = (key: string) => (v: string | string[]) =>
    onChange({ [key]: Array.isArray(v) ? v[0] ?? '' : v });

  const maskedFin =
    mdmProfile?.identifiers.find((i) => i.type === 'AZ_FIN')?.maskedValue ?? null;
  const maskedPassport =
    mdmProfile?.identifiers.find((i) => i.type === 'PASSPORT')?.maskedValue ?? null;
  const hasFin = Boolean(maskedFin && maskedFin !== '***');
  const hasPassport = Boolean(maskedPassport && maskedPassport !== '***');

  async function lookupMdm() {
    const hasParts = Boolean(firstName.trim() && lastName.trim());
    const name = fullName.trim();
    if (!hasParts && !name) {
      setMdmStatus(t('mdm.nameRequired'));
      return;
    }
    const res = await fetch('/api/mdm/person-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildMdmPersonLookupBody({
          fin: transientIdentity.nationalIdFin?.trim() || undefined,
          passport: transientIdentity.passportNumber?.trim() || undefined,
          firstName: firstName.trim() || undefined,
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          fullName: name || undefined,
          phone: phone?.trim() || undefined,
          nationality: nationality || undefined,
        }),
      ),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      onGlobalPersonIdChange(data.globalPersonId);
      setMdmStatus(t('mdm.linked', { id: maskPersonId(data.globalPersonId) }));
    } else {
      onGlobalPersonIdChange(null);
      setMdmStatus(t('mdm.notFound'));
    }
  }

  async function mergeFinObtained() {
    if (!guestId || !globalPersonId) return;
    if (!mergeFin.trim()) return;
    const targetFin = mergeFin.trim().toUpperCase();
    setMergeBusy(true);
    try {
      const lookupRes = await fetch('/api/mdm/person-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildMdmPersonLookupBody({
            fin: targetFin,
            firstName: firstName.trim() || undefined,
            middleName: middleName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            fullName: fullName.trim() || undefined,
            nationality: nationality || undefined,
          }),
        ),
      });
      const lookup = await lookupRes.json();
      if (!lookup.globalPersonId) {
        setMdmStatus(t('mdm.notFound'));
        return;
      }
      const mergeRes = await fetch('/api/mdm/person-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          sourcePersonId: globalPersonId,
          targetPersonId: lookup.globalPersonId,
          fin: targetFin,
          fullName: fullName.trim(),
          nationality,
        }),
      });
      const merged = await mergeRes.json();
      if (!mergeRes.ok) {
        setMdmStatus(merged.error ?? tc('saveFailed'));
        return;
      }
      onGlobalPersonIdChange(merged.globalPersonId ?? lookup.globalPersonId);
      onTransientChange('nationalIdFin', targetFin);
      setMergeFin('');
      setMdmStatus(t('mdm.mergeSuccess'));
      onReload?.();
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
      {locked ? <p className="m-0 text-[12px] text-[#7F8C8D]">{t('locked')}</p> : null}
      <fieldset disabled={locked} className="min-w-0 space-y-3 border-0 p-0">
      <FieldPanel title={t('panels.identity')}>
        {allergenCount != null && allergenCount > 0 ? (
          <p className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-800">
            {t('allergenWarning')} ({allergenCount})
          </p>
        ) : null}
        <div className="space-y-3">
          <FieldRow cols={3}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('fields.title')}
              value={title}
              onChange={setCatalog('title')}
              options={withOrphanOption(byKind.TITLE ?? [], title)}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('fields.gender')}
              value={sex}
              onChange={setCatalog('sex')}
              options={withOrphanOption(byKind.GENDER ?? [], sex)}
              required
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t('fields.nationality')}
              value={nationality}
              onChange={setCatalog('nationality')}
              options={withOrphanOption([...NATIONALITY_OPTIONS], nationality)}
              required
            />
          </FieldRow>
          <FieldRow cols={3}>
            <Field
              label={t('fields.firstName')}
              preset="shortText"
              value={firstName}
              onChange={set('firstName')}
              required
            />
            <Field
              label={t('fields.middleName')}
              preset="shortText"
              value={middleName}
              onChange={set('middleName')}
              hint={t('fields.middleNameHint')}
            />
            <Field
              label={t('fields.lastName')}
              preset="shortText"
              value={lastName}
              onChange={set('lastName')}
              required
            />
          </FieldRow>
          <FieldRow cols={2}>
            <DatePicker
              label={t('details.birthDate')}
              fluid
              value={birthDate}
              onChange={(iso) => onChange({ birthDate: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />
            <Field
              label={t('details.birthPlace')}
              preset="shortText"
              value={birthPlace}
              onChange={set('birthPlace')}
            />
          </FieldRow>
        </div>
      </FieldPanel>

      <FieldPanel title={t('panels.documentsMdm')}>
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[#34495E]">
            <div>
              <dt className="text-[#7F8C8D]">{t('details.phone')}</dt>
              <dd>
                {phone || '—'}
                {!phone ? (
                  <p className="text-[11px] text-[#7F8C8D]">{t('summary.phoneAtCheckIn')}</p>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[#7F8C8D]">{t('details.email')}</dt>
              <dd className="truncate">{email || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[#7F8C8D]">{t('summary.document')}</dt>
              <dd>
                {primaryDocument || t('summary.none')}
                {!primaryDocument ? (
                  <p className="text-[11px] text-[#7F8C8D]">{t('summary.documentAtCheckIn')}</p>
                ) : null}
              </dd>
            </div>
          </dl>
          <FieldRow cols={3}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('details.visaType')}
              value={visaType}
              onChange={setCatalog('visaType')}
              options={withOrphanOption(byKind.VISA_TYPE ?? [], visaType)}
            />
            <Field label={t('details.visaNumber')} preset="shortText" value={visaNumber} onChange={set('visaNumber')} />
            <DatePicker
              label={t('details.visaExpiry')}
              fluid
              value={visaExpiry}
              onChange={(iso) => onChange({ visaExpiry: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
          </FieldRow>
          <Field
            label={t('details.registration')}
            preset="shortText"
            value={registrationNumber}
            onChange={set('registrationNumber')}
          />

          <div className="rounded-xl border border-[#D5DADF] bg-[#F8FAFB] p-3">
            <p className="mb-2 text-[12px] font-medium text-[#34495E]">{t('mdm.title')}</p>
            <p className="text-[12px] text-[#7F8C8D]">
              {t('mdm.badge')}:{' '}
              {globalPersonId ? (
                <span className="text-emerald-700">{maskPersonId(globalPersonId)}</span>
              ) : (
                <span className="text-red-600">{t('mdm.missing')}</span>
              )}
            </p>
            {profileLoading ? (
              <p className="mt-1 text-[11px] text-[#7F8C8D]">{t('mdm.profileLoading')}</p>
            ) : null}
            {globalPersonId && mdmProfile ? (
              <div className="mt-2 space-y-1 text-[12px]">
                {maskedFin ? (
                  <p>
                    {t('details.fin')}: <span className="font-mono">{maskedFin}</span>
                  </p>
                ) : null}
                {maskedPassport ? (
                  <p>
                    {t('details.passport')}: <span className="font-mono">{maskedPassport}</span>
                  </p>
                ) : null}
                {mdmProfile.accessDenied ? (
                  <p className="text-amber-700">{t('mdm.identifierMasked')}</p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void lookupMdm()}>
                {t('mdm.lookup')}
              </button>
              {guestId && globalPersonId && hasPassport && !hasFin ? (
                <>
                  <Field
                    label={t('mdm.mergeFinPrompt')}
                    preset="fin"
                    value={mergeFin}
                    onChange={(e) => setMergeFin(e.target.value)}
                  />
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={mergeBusy || !mergeFin.trim()}
                    onClick={() => void mergeFinObtained()}
                  >
                    {t('mdm.finObtained')}
                  </button>
                </>
              ) : null}
            </div>
            {mdmStatus ? <p className="mt-2 text-[11px] text-[#7F8C8D]">{mdmStatus}</p> : null}
          </div>
        </div>
      </FieldPanel>

      <FieldPanel title={t('panels.commercial')}>
        <div className="space-y-3">
          <FieldRow cols={3}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('fields.vipType')}
              value={vipType}
              onChange={setCatalog('vipType')}
              options={withOrphanOption(byKind.VIP_TYPE ?? [], vipType)}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('loyalty.tier')}
              value={loyaltyTier}
              onChange={setCatalog('loyaltyTier')}
              options={withOrphanOption(byKind.LOYALTY_TIER ?? [], loyaltyTier)}
            />
            <Field
              label={t('details.bonusPercent')}
              preset="amount"
              value={bonusPercent}
              onChange={set('bonusPercent')}
            />
          </FieldRow>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('details.verification')}
            value={verificationStatus}
            onChange={setCatalog('verificationStatus')}
            options={withOrphanOption(byKind.VERIFICATION_STATUS ?? [], verificationStatus)}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={phoneVerified}
                onChange={(e) => onVerified('phoneVerified', e.target.checked)}
              />
              <span className={MODAL_FIELD_LABEL_CLASS.replace('mb-1.5 block ', '')}>
                {t('details.phoneVerified')}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={emailVerified}
                onChange={(e) => onVerified('emailVerified', e.target.checked)}
              />
              <span className={MODAL_FIELD_LABEL_CLASS.replace('mb-1.5 block ', '')}>
                {t('details.emailVerified')}
              </span>
            </label>
          </div>
        </div>
      </FieldPanel>

      <FieldPanel title={t('panels.family')}>
        <div className="space-y-3">
          <FieldRow cols={2}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('details.maritalStatus')}
              value={maritalStatus}
              onChange={setCatalog('maritalStatus')}
              options={withOrphanOption(byKind.MARITAL_STATUS ?? [], maritalStatus)}
            />
            <DatePicker
              label={t('details.marriageDate')}
              fluid
              value={marriageDate}
              onChange={(iso) => onChange({ marriageDate: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t('details.fatherName')}
              preset="shortText"
              value={parentFatherName}
              onChange={set('parentFatherName')}
              hint={t('fields.parentHint')}
            />
            <Field
              label={t('details.motherName')}
              preset="shortText"
              value={parentMotherName}
              onChange={set('parentMotherName')}
              hint={t('fields.parentHint')}
            />
          </FieldRow>
        </div>
      </FieldPanel>

      <FieldPanel title={t('panels.other')}>
        <div className="space-y-3">
          <FieldRow cols={2}>
            <Field
              label={t('details.occupation')}
              preset="shortText"
              value={occupation}
              onChange={set('occupation')}
            />
            <Field label={t('details.vehicle')} preset="shortText" value={vehiclePlate} onChange={set('vehiclePlate')} />
          </FieldRow>
          <Field label={t('details.voen')} preset="voen" value={voen} onChange={set('voen')} hint={t('details.voenHint')} />
        </div>
      </FieldPanel>
      </fieldset>
    </aside>
  );
}
