'use client';

import { useTranslations } from 'next-intl';
import { Field, FieldRow } from '@era/satellite-kit/ui';
import type { LocalizedCatalogRow } from '@/lib/catalog-label';

/** Optional AZ / RU / EN display names for a master-data row; `name` stays the import-owned default. */
export function LocalizedNameFields({
  idPrefix,
  row,
}: {
  idPrefix: string;
  row?: LocalizedCatalogRow | null;
}) {
  const t = useTranslations('masterData');
  return (
    <>
      <FieldRow cols={3}>
        <Field
          label={t('nameAz')}
          preset="shortText"
          id={`${idPrefix}-name-az`}
          name="nameAz"
          defaultValue={row?.nameAz ?? ''}
        />
        <Field
          label={t('nameRu')}
          preset="shortText"
          id={`${idPrefix}-name-ru`}
          name="nameRu"
          defaultValue={row?.nameRu ?? ''}
        />
        <Field
          label={t('nameEn')}
          preset="shortText"
          id={`${idPrefix}-name-en`}
          name="nameEn"
          defaultValue={row?.nameEn ?? ''}
        />
      </FieldRow>
      <p className="m-0 text-[12px] text-[#7F8C8D]">{t('nameTranslationsHint')}</p>
    </>
  );
}

export function localizedNamesFromForm(fd: FormData): {
  nameAz: string;
  nameRu: string;
  nameEn: string;
} {
  return {
    nameAz: String(fd.get('nameAz') ?? ''),
    nameRu: String(fd.get('nameRu') ?? ''),
    nameEn: String(fd.get('nameEn') ?? ''),
  };
}
