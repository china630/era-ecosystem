"use client";

import type { Locale } from "@era/i18n-common";
import { ERA_I18N_COOKIE } from "@era/i18n-common";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "./design-system";

const ORDER: Locale[] = ["az", "ru", "en"];

/** Finance-aligned AZ / RU / EN segmented control (AuthLoginCard + EraAppHeader). */
export function LocaleToggle({
  locale,
  onChange,
  variant = "buttons",
  labels,
}: {
  locale: Locale;
  onChange?: (next: Locale) => void;
  variant?: "buttons";
  labels?: Partial<Record<Locale, string>> & { groupAria?: string };
}) {
  if (variant !== "buttons") return null;
  const labelFor = (code: Locale) => labels?.[code] ?? code.toUpperCase();
  return (
    <div
      className="inline-flex shrink-0 gap-1 rounded-lg border border-[#D5DADF] bg-white p-1 shadow-sm"
      role="group"
      aria-label={labels?.groupAria}
    >
      {ORDER.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          className={locale === code ? PRIMARY_BUTTON_CLASS : GHOST_BUTTON_CLASS}
          onClick={() => onChange?.(code)}
        >
          {labelFor(code)}
        </button>
      ))}
    </div>
  );
}
