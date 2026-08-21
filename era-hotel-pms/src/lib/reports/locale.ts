import type { Locale } from '@era/i18n-common';

const VALID_LOCALES: readonly Locale[] = ['az', 'ru', 'en'] as const;

function isValidLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (VALID_LOCALES as readonly string[]).includes(v);
}

export function parseReportLangParam(request: Request): { ok: true; locale: Locale } | { ok: false; message: string } {
  const url = new URL(request.url);
  const param = url.searchParams.get('lang');
  if (param != null && param !== '' && !isValidLocale(param)) {
    return { ok: false, message: `Invalid lang "${param}"` };
  }
  return { ok: true, locale: resolveReportLocale(request) };
}

export function resolveReportLocale(request: Request): Locale {
  const url = new URL(request.url);
  const param = url.searchParams.get('lang');
  if (isValidLocale(param)) return param;

  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)era_i18n_lang=([^;]+)/);
  if (match && isValidLocale(match[1])) return match[1] as Locale;

  return 'az';
}
