import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  ERA_I18N_COOKIE,
  eraIntlMessageFallback,
  eraIntlOnError,
  isLocale,
  resolveLocale,
  type Locale,
} from "@era/i18n-common";
import { mergeAppMessages } from "@era/i18n-common/server";
import { ERA_SITE_LOCALE_HEADER } from "../lib/site/locale-path";

async function loadAppMessages(locale: Locale): Promise<Record<string, unknown>> {
  if (locale === "az") {
    return (await import("../messages/az.json")).default as Record<string, unknown>;
  }
  return (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale: Locale = defaultLocale;
  try {
    const headerStore = await headers();
    const fromRoute = headerStore.get(ERA_SITE_LOCALE_HEADER);
    if (fromRoute && isLocale(fromRoute)) {
      locale = fromRoute;
    } else {
      const cookieStore = await cookies();
      locale = resolveLocale(cookieStore.get(ERA_I18N_COOKIE)?.value, {
        NEXT_LOCALE: cookieStore.get("NEXT_LOCALE")?.value,
        erafinance_i18n_lang: cookieStore.get("erafinance_i18n_lang")?.value,
      });
    }
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