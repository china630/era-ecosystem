import { isLocale, type Locale } from "@era/i18n-common";

export const ERA_SITE_LOCALE_HEADER = "x-era-locale";

export const SITE_LOCALES = ["az", "ru", "en"] as const satisfies readonly Locale[];

const LOCALE_PREFIX_RE = /^\/(az|ru|en)(\/|$)/;

/** Prefix a public site path with `/{locale}`. */
export function siteLocalePath(locale: Locale, path: string): string {
  const raw = path.startsWith("/") ? path : `/${path}`;
  if (raw === "/") return `/${locale}`;
  return `/${locale}${raw}`;
}

export function localeFromPathname(pathname: string): Locale | null {
  const m = pathname.match(/^\/(az|ru|en)(\/|$)/);
  const code = m?.[1];
  return code && isLocale(code) ? code : null;
}

export function stripLocalePrefix(pathname: string): string {
  const m = pathname.match(/^\/(az|ru|en)(\/.*)?$/);
  if (!m) return pathname;
  const rest = m[2];
  return rest && rest.length > 0 ? rest : "/";
}

export function hasLocalePrefix(pathname: string): boolean {
  return LOCALE_PREFIX_RE.test(pathname);
}

/** Marketing paths that live under `/{locale}/…` on the public site. */
const PUBLIC_MARKETING_PREFIXES = [
  "/satellites",
  "/industries",
  "/pricing",
  // `/calc` stays unprefixed — CalcPageView owns `?q=` history.replaceState.
  "/calculator",
  "/demo",
  "/contact",
  "/help",
  "/terms",
] as const;

export function isPublicMarketingPath(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname);
  if (bare === "/" || bare === "") return true;
  return PUBLIC_MARKETING_PREFIXES.some(
    (p) => bare === p || bare.startsWith(`${p}/`),
  );
}

export function needsLocaleRedirect(pathname: string): boolean {
  if (hasLocalePrefix(pathname)) return false;
  return isPublicMarketingPath(pathname);
}

/** Swap locale segment while keeping the rest of the path and query. */
export function swapLocaleInPath(pathname: string, nextLocale: Locale): string {
  if (hasLocalePrefix(pathname)) {
    return pathname.replace(/^\/(az|ru|en)/, `/${nextLocale}`);
  }
  return siteLocalePath(nextLocale, pathname);
}