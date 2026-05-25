import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale: Locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
