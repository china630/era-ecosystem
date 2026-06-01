"use client";

import type { Locale } from "@era/i18n-common";

export type LegalUrls = {
  terms?: string;
  privacy?: string;
  status?: string;
};

function readPublicEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

export function resolveLegalUrls(
  locale: Locale,
  appPrefix = "ERA",
): LegalUrls {
  const suffix = locale === "az" ? "_AZ" : locale === "ru" ? "_RU" : "_EN";
  const key = (base: string) =>
    readPublicEnv(`NEXT_PUBLIC_${appPrefix}_${base}${suffix}`) ??
    readPublicEnv(`NEXT_PUBLIC_ERA_${base}${suffix}`) ??
    readPublicEnv(`NEXT_PUBLIC_${appPrefix}_${base}`) ??
    readPublicEnv(`NEXT_PUBLIC_ERA_${base}`);
  return {
    terms: key("TERMS_URL"),
    privacy: key("PRIVACY_URL"),
    status:
      readPublicEnv(`NEXT_PUBLIC_${appPrefix}_STATUS_URL`) ??
      readPublicEnv("NEXT_PUBLIC_ERA_STATUS_URL"),
  };
}

export function PublicLegalFooter({
  locale,
  faqHref = "/help",
  appPrefix = "ERA",
  labels,
  showFaq: showFaqProp,
  urls: urlsProp,
}: {
  locale: Locale;
  faqHref?: string;
  appPrefix?: string;
  labels: {
    navAria: string;
    faq: string;
    terms: string;
    privacy: string;
    status: string;
  };
  /** When false, FAQ link is omitted (login card already links to FAQ above). */
  showFaq?: boolean;
  urls?: LegalUrls;
}) {
  const urls = urlsProp ?? resolveLegalUrls(locale, appPrefix);
  const showFaq = showFaqProp ?? true;
  return (
    <nav
      className="mt-8 flex flex-wrap gap-4 text-xs text-[#7F8C8D]"
      aria-label={labels.navAria}
    >
      {showFaq ? (
        <a href={faqHref} className="hover:text-[#2980B9]">
          {labels.faq}
        </a>
      ) : null}
      {urls.terms ? (
        <a href={urls.terms} className="hover:text-[#2980B9]" target="_blank" rel="noreferrer">
          {labels.terms}
        </a>
      ) : null}
      {urls.privacy ? (
        <a href={urls.privacy} className="hover:text-[#2980B9]" target="_blank" rel="noreferrer">
          {labels.privacy}
        </a>
      ) : null}
      {urls.status ? (
        <a href={urls.status} className="hover:text-[#2980B9]" target="_blank" rel="noreferrer">
          {labels.status}
        </a>
      ) : null}
    </nav>
  );
}
