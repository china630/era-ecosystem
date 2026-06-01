"use client";

import type { FormEvent, ReactNode } from "react";
import type { Locale } from "@era/i18n-common";
import { CARD_CONTAINER_CLASS, LINK_ACCENT_CLASS } from "./design-system";
import { SatelliteLocaleToggle } from "./satellite-locale-toggle";
import { AuthPageHeader } from "./auth-page-header";

export type AuthPublicShellProps = {
  locale: Locale;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showLocaleToggle?: boolean;
  localeControl?: ReactNode;
  localeLabels?: {
    groupAria?: string;
    az?: string;
    ru?: string;
    en?: string;
  };
};

/** Shared full-screen public card shell — matches Finance login layout. */
export function AuthPublicShell({
  locale,
  title,
  subtitle,
  children,
  footer,
  showLocaleToggle = true,
  localeControl,
  localeLabels,
}: AuthPublicShellProps) {
  const localeToggle =
    localeControl ??
    (showLocaleToggle ? (
      <SatelliteLocaleToggle locale={locale} labels={localeLabels} />
    ) : null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#EBEDF0] p-6">
      <div className={`w-full max-w-md p-8 ${CARD_CONTAINER_CLASS}`}>
        {localeToggle ? (
          <AuthPageHeader title={title} localeControl={localeToggle} />
        ) : (
          <h1 className="mb-6 text-2xl font-semibold text-[#34495E]">{title}</h1>
        )}
        {subtitle ? (
          <p className="mb-4 text-sm text-[#7F8C8D]">{subtitle}</p>
        ) : null}
        {children}
        {footer}
      </div>
    </main>
  );
}

export { LINK_ACCENT_CLASS };

export type AuthRegisterCardProps = {
  locale: Locale;
  title: string;
  subtitle?: string;
  fields: ReactNode;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  submitBusyLabel: string;
  footer?: ReactNode;
  showLocaleToggle?: boolean;
  localeLabels?: {
    groupAria?: string;
    az?: string;
    ru?: string;
    en?: string;
  };
};

/** Registration card — same DESIGN.md shell as AuthLoginCard. */
export function AuthRegisterCard({
  locale,
  title,
  subtitle,
  fields,
  onSubmit,
  busy = false,
  error: _error,
  submitLabel,
  submitBusyLabel,
  footer,
  showLocaleToggle = true,
  localeLabels,
}: AuthRegisterCardProps) {
  return (
    <AuthPublicShell
      locale={locale}
      title={title}
      subtitle={subtitle}
      footer={footer}
      showLocaleToggle={showLocaleToggle}
      localeLabels={localeLabels}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {fields}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 min-h-9 w-full shrink-0 items-center justify-center rounded-lg bg-[#2980B9] px-4 text-[13px] font-semibold text-white hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9] disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? submitBusyLabel : submitLabel}
        </button>
      </form>
    </AuthPublicShell>
  );
}
