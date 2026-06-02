'use client';

import { useTranslations } from 'next-intl';
import { FORM_FIELD_GROUP_CLASS, MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from '@era/satellite-kit/ui';

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
      {(
        [
          ['fullName', fullName, t('fields.fullName')],
          ['firstName', firstName, t('fields.firstName')],
          ['lastName', lastName, t('fields.lastName')],
          ['title', title, t('fields.title')],
          ['gender', gender, t('fields.gender')],
          ['nationality', nationality, t('fields.nationality')],
          ['vipType', vipType, t('fields.vipType')],
        ] as const
      ).map(([key, val, label]) => (
        <div key={key} className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{label}</label>
          <input
            className={MODAL_INPUT_CLASS}
            value={val}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
        </div>
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
