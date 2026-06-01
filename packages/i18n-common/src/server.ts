import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  ERA_I18N_COOKIE,
  isLocale,
  resolveLocale,
  type Locale,
} from "./locale";
import { mergeAppMessages } from "./merge-app-messages";
import { eraIntlMessageFallback, eraIntlOnError } from "./intl-error-handlers";

export { mergeAppMessages } from "./merge-app-messages";

export function createNextIntlRequest(
  loadAppMessages: (locale: Locale) => Promise<Record<string, unknown>>,
) {
  return getRequestConfig(async ({ requestLocale }) => {
    let locale: Locale = defaultLocale;
    try {
      const cookieStore = await cookies();
      locale = resolveLocale(cookieStore.get(ERA_I18N_COOKIE)?.value, {
        NEXT_LOCALE: cookieStore.get("NEXT_LOCALE")?.value,
        erafinance_i18n_lang: cookieStore.get("erafinance_i18n_lang")?.value,
      });
    } catch {
      const requested = await requestLocale;
      locale = isLocale(requested) ? requested : defaultLocale;
    }
    const appMessages = await loadAppMessages(locale);
    const messages = mergeAppMessages(locale, appMessages);
    return {
      locale,
      messages,
      onError: eraIntlOnError,
      getMessageFallback: eraIntlMessageFallback,
    };
  });
}
