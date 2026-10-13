/** Must equal packages/satellite-kit/icd10 catalog version (asserted in icd10-catalog.spec). */
export const ICD10_VERSION = "WHO-ICD-10-2019+RU-1005-2.27+AZ-XBT10-2012";

export class IcdCatalogError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "IcdCatalogError";
    this.status = status;
  }
}

export type IcdLocale = "en" | "ru" | "az";

export function normalizeIcdLocale(raw?: string | null): IcdLocale {
  const v = (raw ?? "en").toLowerCase();
  if (v.startsWith("ru")) return "ru";
  if (v.startsWith("az")) return "az";
  return "en";
}

type IcdTitles = { titleEn: string; titleRu?: string | null; titleAz?: string | null };

/** Missing translations (codes added after the source edition) fall back ru → az → en. */
export function icdTitle(row: IcdTitles, locale: IcdLocale): string {
  const ru = row.titleRu?.trim();
  const az = row.titleAz?.trim();
  if (locale === "ru") return ru || az || row.titleEn;
  if (locale === "az") return az || ru || row.titleEn;
  return row.titleEn;
}

export function formatIcdLabel(row: IcdTitles & { code: string }, locale: IcdLocale): string {
  return `${row.code} — ${icdTitle(row, locale)}`;
}
