'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { eraIntlMessageFallback, eraIntlOnError } from '@era/i18n-common';
import type { ReactNode } from 'react';

type Props = {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

/**
 * Client intl boundary — must live in the app bundle (same next-intl module as useTranslations hooks).
 */
export function HotelIntlProvider({ locale, messages, children }: Props) {
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
