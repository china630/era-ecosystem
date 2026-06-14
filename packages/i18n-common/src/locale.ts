export const locales = ["az", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "az";
export const ERA_I18N_COOKIE = "era_i18n_lang";

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}

export function uiLang(value: string | undefined | null): Locale {
  return resolveLocale(value);
}

export function intlLocaleTag(value: string | undefined | null): string {
  const l = uiLang(value);
  if (l === "ru") return "ru-RU";
  if (l === "en") return "en-US";
  return "az-AZ";
}

export function pickLocale(
  preferred: string | undefined | null,
  fallback: Locale = defaultLocale,
): Locale {
  return isLocale(preferred) ? preferred : fallback;
}

export function resolveLocale(
  primary?: string | null,
  legacy?: Record<string, string | undefined | null>,
): Locale {
  if (isLocale(primary)) return primary;
  if (legacy) {
    for (const v of Object.values(legacy)) {
      if (isLocale(v)) return v;
    }
  }
  return defaultLocale;
}

export function mergeMessages(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = mergeMessages(
        prev as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function eraLocaleCookieOptions(): {
  path: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    /** Only Secure on explicit HTTPS deployments (local Docker uses HTTP). */
    secure: process.env.ERA_I18N_COOKIE_SECURE === "true",
  };
}
