'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal } from '@/components/EraModal';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

export function GuestCardDetailsTab({
  fields,
  phoneVerified,
  emailVerified,
  onChange,
  onVerified,
}: {
  fields: Record<string, string>;
  phoneVerified: boolean;
  emailVerified: boolean;
  onChange: (key: string, value: string) => void;
  onVerified: (key: 'phoneVerified' | 'emailVerified', value: boolean) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [accountingOpen, setAccountingOpen] = useState(false);

  const items: [string, string][] = [
    ['phone', t('details.phone')],
    ['email', t('details.email')],
    ['birthDate', t('details.birthDate')],
    ['birthPlace', t('details.birthPlace')],
    ['occupation', t('details.occupation')],
    ['nationalIdFin', t('details.fin')],
    ['passportNumber', t('details.passport')],
    ['visaType', t('details.visaType')],
    ['visaNumber', t('details.visaNumber')],
    ['visaExpiry', t('details.visaExpiry')],
    ['marriageDate', t('details.marriageDate')],
    ['bonusPercent', t('details.bonusPercent')],
    ['maritalStatus', t('details.maritalStatus')],
    ['fatherName', t('details.fatherName')],
    ['motherName', t('details.motherName')],
    ['verificationStatus', t('details.verification')],
    ['registrationNumber', t('details.registration')],
    ['vehiclePlate', t('details.vehicle')],
    ['hotelName', t('details.hotelName')],
    ['voen', t('details.voen')],
  ];

  return (
    <div className="space-y-3 text-[13px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(([key, label]) => (
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
