import type { Metadata } from "next";
import type { Locale } from "@era/i18n-common";
import type { SiteContacts } from "./fetch-site-contacts";
import { SITE_LOCALES } from "./locale-path";
import { siteOrigin, siteUrl } from "./site-origins";

const BRAND = "ERA 365";
export const SITE_TITLE_SUFFIX = ` | ${BRAND}`;

const OG_LOCALE: Record<Locale, string> = {
  az: "az_AZ",
  ru: "ru_RU",
  en: "en_US",
};

/** Public marketing title — appends brand unless already present. */
export function pageTitle(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return BRAND;
  if (trimmed.includes(BRAND)) return trimmed;
  return `${trimmed}${SITE_TITLE_SUFFIX}`;
}

/** hreflang map: az, ru, en, and x-default → Azerbaijani URL. */
export function buildAlternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of SITE_LOCALES) {
    languages[l] = siteUrl(path, l);
  }
  languages["x-default"] = siteUrl(path, "az");
  return languages;
}

export type BuildSiteMetadataInput = {
  locale: Locale;
  /** Path without locale prefix, e.g. `/` or `/satellites/hotel`. */
  path: string;
  title: string;
  description: string;
  ogType?: "website" | "article";
};

export function buildSiteMetadata(input: BuildSiteMetadataInput): Metadata {
  const canonical = siteUrl(input.path, input.locale);
  const alternateLocale = SITE_LOCALES.filter((l) => l !== input.locale).map(
    (l) => OG_LOCALE[l],
  );

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      languages: buildAlternateLanguages(input.path),
    },
    openGraph: {
      type: input.ogType ?? "website",
      url: canonical,
      title: input.title,
      description: input.description,
      siteName: BRAND,
      locale: OG_LOCALE[input.locale],
      alternateLocale,
    },
  };
}

export function jsonLdOrganization(contacts?: Partial<SiteContacts>): Record<string, unknown> {
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: siteOrigin(),
  };

  const email = contacts?.email?.trim();
  if (email) {
    org.email = email;
  }

  const phone = contacts?.phoneE164?.trim() || contacts?.phone?.trim();
  if (phone) {
    org.telephone = phone;
  }

  const legalName = contacts?.legalName?.trim();
  if (legalName) {
    org.legalName = legalName;
  }

  return org;
}

export function jsonLdSoftwareApplication(input: {
  name: string;
  description: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    provider: {
      "@type": "Organization",
      name: BRAND,
      url: siteOrigin(),
    },
  };
}

export function jsonLdProduct(input: {
  name: string;
  description: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    url: input.url,
    brand: {
      "@type": "Brand",
      name: BRAND,
    },
  };
}