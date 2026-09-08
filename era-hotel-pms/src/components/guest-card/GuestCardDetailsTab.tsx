'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal } from '@/components/EraModal';
import { buildMdmPersonLookupBody } from '@/lib/mdm-person-lookup-body';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

function maskPersonId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

type MdmProfile = {
  identifiers: Array<{ type: string; maskedValue: string; isPrimary: boolean }>;
  accessDenied?: boolean;
};

export function GuestCardDetailsTab({
  fields,
  transientIdentity,
  mdmProfile,
  profileLoading,
  phoneVerified,
  emailVerified,
  fullName,
  firstName = '',
  middleName = '',
  lastName = '',
  nationality,
  guestId,
  globalPersonId,
  onGlobalPersonIdChange,
  onReload,
  onChange,
  onTransientChange,
  onVerified,
}: {
  fields: Record<string, string>;
  transientIdentity: { nationalIdFin: string; passportNumber: string };
  mdmProfile: MdmProfile | null;
  profileLoading?: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nationality: string;
  guestId: string | null;
  globalPersonId: string | null;
  onGlobalPersonIdChange: (id: string | null) => void;
  onReload?: () => void;
  onChange: (key: string, value: string) => void;
  onTransientChange: (key: 'nationalIdFin' | 'passportNumber', value: string) => void;
  onVerified: (key: 'phoneVerified' | 'emailVerified', value: boolean) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);

  const opsItems: [string, string][] = [
    ['phone', t('details.phone')],
    ['email', t('details.email')],
    ['birthDate', t('details.birthDate')],
    ['birthPlace', t('details.birthPlace')],
    ['occupation', t('details.occupation')],
    ['visaType', t('details.visaType')],
    ['visaNumber', t('details.visaNumber')],
    ['visaExpiry', t('details.visaExpiry')],
    ['marriageDate', t('details.marriageDate')],
    ['bonusPercent', t('details.bonusPercent')],
    ['maritalStatus', t('details.maritalStatus')],
    ['parentFatherName', t('details.fatherName')],
    ['parentMotherName', t('details.motherName')],
    ['verificationStatus', t('details.verification')],
    ['registrationNumber', t('details.registration')],
    ['vehiclePlate', t('details.vehicle')],
    ['hotelName', t('details.hotelName')],
    ['voen', t('details.voen')],
  ];

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
          phone: fields.phone?.trim() || undefined,
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
    const fin = window.prompt(t('mdm.mergeFinPrompt'));
    if (!fin?.trim()) return;
    const targetFin = fin.trim().toUpperCase();
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
      setMdmStatus(t('mdm.mergeSuccess'));
      onReload?.();
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-[13px]">
      <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFB] p-3">
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
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('details.fin')} (lookup)</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={transientIdentity.nationalIdFin}
              onChange={(e) => onTransientChange('nationalIdFin', e.target.value)}
              placeholder={hasFin ? t('mdm.identifierMasked') : ''}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('details.passport')} (lookup)</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={transientIdentity.passportNumber}
              onChange={(e) => onTransientChange('passportNumber', e.target.value)}
              placeholder={hasPassport ? t('mdm.identifierMasked') : ''}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void lookupMdm()}>
            {t('mdm.lookup')}
          </button>
          {guestId && globalPersonId && hasPassport && !hasFin ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={mergeBusy}
              onClick={() => void mergeFinObtained()}
            >
              {t('mdm.finObtained')}
            </button>
          ) : null}
        </div>
        {mdmStatus ? <p className="mt-2 text-[11px] text-[#7F8C8D]">{mdmStatus}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {opsItems.map(([key, label]) => (
          <div key={key} className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{label}</label>
            <input
              className={MODAL_INPUT_CLASS}
              type={key.includes('Date') || key === 'visaExpiry' ? 'date' : 'text'}
              value={fields[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={phoneVerified}
            onChange={(e) => onVerified('phoneVerified', e.target.checked)}
          />
          {t('details.phoneVerified')}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={emailVerified}
            onChange={(e) => onVerified('emailVerified', e.target.checked)}
          />
          {t('details.emailVerified')}
        </label>
      </div>
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        onClick={() => setAccountingOpen(true)}
      >
        {t('details.createAccounting')}
      </button>
      <p className="text-[12px] text-[#7F8C8D]">{t('details.accountingHint')}</p>
      <EraModal open={accountingOpen} title={t('details.createAccounting')} onClose={() => setAccountingOpen(false)}>
        <p className="text-[13px] text-[#7F8C8D]">{t('details.accountingStub')}</p>
        <button type="button" className={`${SECONDARY_BUTTON_CLASS} mt-3`} onClick={() => setAccountingOpen(false)}>
          {tc('close')}
        </button>
      </EraModal>
    </div>
  );
}
