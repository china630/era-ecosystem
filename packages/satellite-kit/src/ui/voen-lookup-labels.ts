export type VoenLookupFieldLabels = {
  voen: string;
  check: string;
  found: string;
  notFound: string;
  invalid: string;
};

/** Standard i18n keys for {@link VoenLookupField} — pass `useTranslations()` callback. */
export function buildVoenLookupLabels(
  t: (key: string) => string,
  namespace = "voenLookup",
): VoenLookupFieldLabels {
  return {
    voen: t(`${namespace}.voen`),
    check: t(`${namespace}.check`),
    found: t(`${namespace}.found`),
    notFound: t(`${namespace}.notFound`),
    invalid: t(`${namespace}.invalid`),
  };
}
