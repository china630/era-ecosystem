'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
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
