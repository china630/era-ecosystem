"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "./locale";
import { eraIntlMessageFallback, eraIntlOnError } from "./intl-error-handlers";

export type EraIntlClientProviderProps = {
  children: ReactNode;
  locale: Locale | string;
  messages: AbstractIntlMessages;
};

/**
 * Client-side next-intl provider with shared error handlers —
 * missing keys log a warning and render fallback text instead of crashing the app.
 */
export function EraIntlClientProvider({
  children,
  locale,
  messages,
}: EraIntlClientProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={eraIntlOnError}
      getMessageFallback={eraIntlMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
