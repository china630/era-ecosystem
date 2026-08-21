export const ICD10_VERSION = "WHO-ICD-10-2019";

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

export function icdTitle(
  row: { titleEn: string; titleRu: string; titleAz?: string | null },
  locale: IcdLocale,
): string {
  if (locale === "ru") return row.titleRu;
  if (locale === "az") return row.titleAz?.trim() || row.titleRu;
  return row.titleEn;
}

export function formatIcdLabel(
  row: { code: string; titleEn: string; titleRu: string; titleAz?: string | null },
  locale: IcdLocale,
): string {
  return `${row.code} — ${icdTitle(row, locale)}`;
}
