'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { MODAL_INPUT_CLASS } from '@era/satellite-kit/ui';
import { locales, type Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('locale');
  const router = useRouter();

  async function onChange(next: string) {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-[12px] text-[#7F8C8D]">
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        className={`${MODAL_INPUT_CLASS} !h-8 !min-h-8 text-[12px]`}
        aria-label={t('label')}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
