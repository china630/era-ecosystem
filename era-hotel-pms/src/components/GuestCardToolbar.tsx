'use client';

import { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export function GuestCardToolbar({
  subtitle,
  busy,
  loading,
  onClose,
  onSave,
}: {
  subtitle?: string;
  busy?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSave?: () => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DADF] pb-2">
      <span className="min-w-0 truncate text-[13px] font-semibold text-[#34495E]">
        {subtitle ?? t('title')}
      </span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled title={t('comingSoon')}>
          {t('toolbar.copy')}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => window.print()}
        >
          {t('toolbar.print')}
        </button>
        {onSave ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || loading}
            onClick={onSave}
          >
            {tc('save')}
          </button>
        ) : null}
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
          {tc('close')}
        </button>
      </div>
    </div>
  );
}
