import { z } from 'zod';

export type LocalizedCatalogRow = {
  code?: string | null;
  name?: string | null;
  nameAz?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
};

/** Display name of a master-data row for the UI locale; `name` is the import-owned fallback. */
export function catalogLabel(row: LocalizedCatalogRow, locale: string | null | undefined): string {
  const lang = (locale ?? '').slice(0, 2).toLowerCase();
  const localized = lang === 'az' ? row.nameAz : lang === 'ru' ? row.nameRu : lang === 'en' ? row.nameEn : null;
  const pick = localized?.trim() || row.name?.trim() || row.code?.trim() || '';
  return pick;
}

const optionalName = z
  .string()
  .max(200)
  .nullish()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v?.trim() ?? '';
    return t ? t : null;
  });

/** Zod fragment for the three optional translations accepted by master-data APIs. */
export const localizedNameFields = {
  nameAz: optionalName,
  nameRu: optionalName,
  nameEn: optionalName,
};
