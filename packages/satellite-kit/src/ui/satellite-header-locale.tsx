"use client";

import type { Locale } from "@era/i18n-common";
import { SatelliteLocaleToggle } from "./satellite-locale-toggle";

type Props = {
  locale: Locale;
  labels?: {
    groupAria?: string;
    az?: string;
    ru?: string;
    en?: string;
  };
};

const SHORT_LOCALE_LABELS = { az: "AZ", ru: "RU", en: "EN" } as const;

/** Locale toggle for authenticated app header — pass `locale` from app shell (same next-intl bundle). */
export function SatelliteHeaderLocale({ locale, labels }: Props) {
  return (
    <SatelliteLocaleToggle
      locale={locale}
      labels={{
        groupAria: labels?.groupAria,
        az: SHORT_LOCALE_LABELS.az,
        ru: SHORT_LOCALE_LABELS.ru,
        en: SHORT_LOCALE_LABELS.en,
      }}
    />
  );
}
