import { intlLocaleTag, uiLang, type Locale } from "@era/i18n-common";

export type { Locale };

/** @deprecated Use `uiLang` — kept for gradual migration. */
export function uiLangRuAz(lang: string | undefined | null): "ru" | "az" {
  const l = uiLang(lang);
  return l === "ru" ? "ru" : "az";
}

export { uiLang, intlLocaleTag };

/** @deprecated Use `intlLocaleTag`. */
export function intlLocaleRuAz(lang: string | undefined | null): "ru-RU" | "az-AZ" {
  const tag = intlLocaleTag(lang);
  return tag.startsWith("ru") ? "ru-RU" : "az-AZ";
}
