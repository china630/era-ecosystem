"use client";

import { eraIntlMessageFallback, eraIntlOnError } from "@era/i18n-common";
import {
  NextIntlClientProvider,
  type AbstractIntlMessages,
} from "next-intl";
import type { ReactNode } from "react";

/** Client boundary: safe onError/getMessageFallback (cannot pass from Server Components). */
export function IntlClientProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
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
