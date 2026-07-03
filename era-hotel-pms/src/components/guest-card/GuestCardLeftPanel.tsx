'use client';

import { useTranslations } from 'next-intl';
import { Field } from '@era/satellite-kit/ui';

export function GuestCardLeftPanel({
  fullName,
  firstName,
  lastName,
  title,
  gender,
  nationality,
  vipType,
  greyList,
  problematic,
  allergenCount,
  onChange,
  onIdReader,
}: {
  fullName: string;
  firstName: string;
  lastName: string;
  title: string;
  gender: string;
  nationality: string;
  vipType: string;
  greyList: boolean;
  problematic: boolean;
  allergenCount?: number;
  onChange: (patch: Record<string, string | boolean>) => void;
  onIdReader?: () => void;
}) {
  const t = useTranslations('guestCard');

  const scalarFields = [
    ['fullName', fullName, t('fields.fullName'), 'longText'] as const,
    ['firstName', firstName, t('fields.firstName'), 'shortText'] as const,
    ['lastName', lastName, t('fields.lastName'), 'shortText'] as const,
    ['title', title, t('fields.title'), 'code'] as const,
    ['gender', gender, t('fields.gender'), 'code'] as const,
    ['nationality', nationality, t('fields.nationality'), 'code'] as const,
    ['vipType', vipType, t('fields.vipType'), 'shortText'] as const,
  ];

  return (
    <aside className="space-y-3 border-r border-[#D5DADF] pr-3">
      {allergenCount != null && allergenCount > 0 ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-800">
          {t('allergenWarning')} ({allergenCount})
        </p>
      ) : null}
      <button
        type="button"
        className="w-full rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#34495E] hover:bg-[#EBEDF0]"
        onClick={onIdReader}
        title={t('idReaderHint')}
      >
        {t('idReader')}
      </button>
      {scalarFields.map(([key, val, label, preset]) => (
        <Field
          key={key}
          label={label}
          preset={preset}
          value={val}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      ))}
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={greyList}
          onChange={(e) => onChange({ greyList: e.target.checked })}
        />
        {t('greyList')}
      </label>
      <label className="flex items-center gap-2 text-[13px] text-red-700">
        <input
          type="checkbox"
          checked={problematic}
          onChange={(e) => onChange({ problematic: e.target.checked })}
        />
        {t('problematic')}
      </label>
    </aside>
  );
}
