export const locales = ["en", "ru", "az"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function resolveLocale(cookieValue: string | undefined): Locale {
  if (cookieValue && isLocale(cookieValue)) return cookieValue;
  const env = process.env.DEFAULT_LOCALE;
  if (env && isLocale(env)) return env;
  return defaultLocale;
}
