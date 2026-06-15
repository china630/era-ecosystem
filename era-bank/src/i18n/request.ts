import { createNextIntlRequest } from "@era/i18n-common/server";

export default createNextIntlRequest(async (locale) => {
  if (locale === "az") {
    return (await import("../../messages/az.json")).default as Record<
      string,
      unknown
    >;
  }
  return (await import(`../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;
});
