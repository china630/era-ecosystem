import type { IntlError } from "next-intl";

/** Avoid client crash on missing keys; log once in dev. */
export function eraIntlOnError(error: IntlError): void {
  if (error.code === "MISSING_MESSAGE") {
    console.warn("[i18n]", error.message);
    return;
  }
  console.error(error);
}

export function eraIntlMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
}): string {
  return namespace ? `${namespace}.${key}` : key;
}
