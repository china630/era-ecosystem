/**
 * ISO 3166-1 alpha-2 for citizenship and passport issuing country.
 * Temporary kit table (az / en / ru) until orchestrator GET /platform/v1/catalog/countries
 * proxies hub Country SoR. Not hotel master data. Do not use Intl.DisplayNames
 * (host ICU often falls back to Russian for az-Latn).
 */
import { ISO_COUNTRIES } from "./iso-country-names";

export { ISO_COUNTRIES };
export type { IsoCountry } from "./iso-country-names";

const BY_CODE = new Map(ISO_COUNTRIES.map((row) => [row.code, row]));
const CODE_SET = new Set(ISO_COUNTRIES.map((row) => row.code));

function sortLocale(locale: string): string {
  const base = locale.toLowerCase().split("-")[0];
  if (base === "az" || base === "ru" || base === "en") return base;
  return "en";
}

function countryName(code: string, locale: string): string | null {
  const row = BY_CODE.get(code);
  if (!row) return null;
  const base = locale.toLowerCase().split("-")[0];
  if (base === "az") return row.nameAz;
  if (base === "ru") return row.nameRu;
  return row.nameEn;
}

export function countryLabel(code: string | null | undefined, locale: string): string {
  const raw = code?.trim();
  if (!raw) return "—";
  const upper = raw.toUpperCase();
  const name = countryName(upper, locale);
  return name ? `${name} (${upper})` : upper;
}

/** Searchable options. Keeps a stored code that is not ISO (for example a surrogate) visible. */
export function countryOptions(
  locale: string,
  current?: string | null,
): Array<{ value: string; label: string }> {
  const options = ISO_COUNTRIES.map((row) => ({
    value: row.code,
    label: countryLabel(row.code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, sortLocale(locale)));
  const extra = current?.trim().toUpperCase();
  if (extra && !CODE_SET.has(extra)) {
    return [{ value: extra, label: extra }, ...options];
  }
  return options;
}
