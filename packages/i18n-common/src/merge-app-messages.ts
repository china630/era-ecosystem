import commonAz from "../messages/common.az.json";
import commonRu from "../messages/common.ru.json";
import commonEn from "../messages/common.en.json";
import { mergeMessages, type Locale } from "./locale";

const COMMON_BY_LOCALE: Record<Locale, Record<string, unknown>> = {
  az: commonAz as Record<string, unknown>,
  ru: commonRu as Record<string, unknown>,
  en: commonEn as Record<string, unknown>,
};

/** Merge shared common.*.json with app locale messages. */
export function mergeAppMessages(
  locale: Locale,
  appMessages: Record<string, unknown>,
): Record<string, unknown> {
  const common = COMMON_BY_LOCALE[locale];
  const azBase = COMMON_BY_LOCALE.az;
  return locale === "az"
    ? mergeMessages(mergeMessages(azBase, common), appMessages)
    : mergeMessages(mergeMessages(azBase, appMessages), common);
}
