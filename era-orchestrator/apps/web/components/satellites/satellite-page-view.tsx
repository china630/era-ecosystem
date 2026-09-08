"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@era/i18n-common";
import { PRIMARY_BUTTON_CLASS, PublicLegalFooter, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { getLandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { getSatellitePageCopy, getSatellitesIndexCopy } from "../../lib/i18n/satellite-page-copy";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import type { PublicIndustryGroup, PublicPricingResponse } from "../../lib/public-pricing-types";
import {
  PUBLIC_SATELLITE_PAGES,
  pricingHrefForSatellite,
  type PublicSatelliteDef,
  type PublicSatelliteSlug,
} from "../../lib/satellites/public-satellite-catalog";
import { LandingChrome } from "../landing/landing-chrome";
import { LandingEcosystemGrid } from "../landing/landing-ecosystem-grid";
import { LandingFeatureSplits } from "../landing/landing-feature-splits";
import { LandingLegacyCompare } from "../landing/landing-legacy-compare";
import { LandingPageShell } from "../landing/landing-page-shell";

const FAQ_LABELS = {
  az: { navAria: "Hüquqi keçidlər", faq: "FAQ", terms: "Şərtlər", privacy: "Məxfilik", status: "Status" },
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Статус" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

function fmtAzn(n: number, locale: Locale): string {
  const suffix = locale === "ru" ? " / мес" : " / ay";
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN${suffix}`;
}

function XorChips({ title, chips }: { title: string | null; chips: string[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-5">
      {title ? <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{title}</p> : null}
      <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-2.5 py-0.5 text-[11px] font-medium text-[#2471A3]"
          >
            {chip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveModules({
  group,
  addons,
  locale,
}: {
  group: PublicIndustryGroup | null;
  addons: Array<{ key: string; name: string; pricePerMonth: number }>;
  locale: Locale;
}) {
  const rows =
    group != null
      ? [
          ...(group.gate
            ? [{ key: group.gate.key, name: group.gate.name, pricePerMonth: group.gate.pricePerMonth }]
            : []),
          ...group.modules,
        ]
      : addons;
  if (rows.length === 0) return null;
  return (
    <ul className="mt-6 grid list-none gap-2 p-0 sm:grid-cols-2">
      {rows.map((m) => (
        <li
          key={m.key}
          className="flex items-center justify-between rounded-xl border border-[#D5DADF] bg-white px-4 py-3 text-sm"
        >
          <span className="pr-2 font-medium text-[#34495E]">{m.name}</span>
          <span className="shrink-0 tabular-nums text-[#7F8C8D]">{fmtAzn(m.pricePerMonth, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SatellitePageView({
  slug,
  initialLocale,
}: {
  slug: PublicSatelliteSlug;
  initialLocale: Locale;
}) {
  const def = PUBLIC_SATELLITE_PAGES.find((p) => p.slug === slug) as PublicSatelliteDef;
  const [locale, setLocale] = useState(initialLocale);
  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const landing = useMemo(() => getLandingMarketingCopy(locale), [locale]);
  const copy = useMemo(() => getSatellitePageCopy(locale, slug), [locale, slug]);
  const legalLabels = FAQ_LABELS[locale] ?? FAQ_LABELS.az;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    void fetchPublicPricingSnapshot().then(setPricing);
  }, []);

  const group =
    def.satelliteKey && pricing && !pricing.unavailable
      ? (pricing.industryGroups ?? []).find((g) => g.satelliteKey === def.satelliteKey) ?? null
      : null;

  const dataHubAddons =
    def.kind === "platform" && pricing && !pricing.unavailable
      ? (pricing.platformAddons ?? []).filter((m) => def.dataHubKeys?.includes(m.key))
      : [];

  const financeEcosystem =
    slug === "finance"
      ? {
          ...landing.ecosystem,
          sections: landing.ecosystem.sections.filter((s) => s.id === "operational" || s.id === "premium"),
        }
      : null;

  return (
    <LandingPageShell>
      <LandingChrome
        hero={landing.hero}
        loginLabel={landing.chrome.login}
        satellitesLabel={landing.chrome.navSatellites}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-[#2980B9]">{copy.kicker}</p>
        <h1 className="mt-2 m-0 text-3xl font-bold tracking-tight text-[#34495E] md:text-4xl">{copy.title}</h1>
        <p className="mt-3 m-0 max-w-3xl text-[16px] leading-relaxed text-[#7F8C8D]">{copy.tagline}</p>

        <section className="mt-8 rounded-2xl border border-[#D5DADF] bg-white p-5 shadow-sm">
          <h2 className="m-0 text-[16px] font-bold text-[#34495E]">{copy.gateTitle}</h2>
          <ul className="mt-3 space-y-2 p-0 list-none">
            {copy.gateBullets.map((b) => (
              <li key={b} className="flex gap-2 text-[14px] leading-snug text-[#34495E]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2980B9]" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {group?.capacity ? (
            <p className="mt-4 m-0 text-[13px] text-[#7F8C8D]">
              Gate: {group.capacity.includedInGate} {group.capacity.unit}, {group.capacity.unitAzn} AZN / {group.capacity.unit}
            </p>
          ) : null}
          <XorChips title={copy.xorTitle} chips={copy.xorChips} />
          {copy.bankNote ? (
            <p className="mt-4 m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              {copy.bankNote}
            </p>
          ) : null}
          <LiveModules group={group} addons={dataHubAddons} locale={locale} />
          <p className="mt-4 m-0 text-[12px] text-[#7F8C8D]">{copy.catalogNote}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={pricingHrefForSatellite(slug)} className={`${PRIMARY_BUTTON_CLASS} text-sm no-underline`}>
              {copy.pricingCta}
            </Link>
            <Link href="/register-org" className={`${SECONDARY_BUTTON_CLASS} text-sm no-underline`}>
              {copy.registerCta}
            </Link>
          </div>
        </section>
      </main>

      {slug === "finance" && financeEcosystem ? (
        <>
          <LandingEcosystemGrid copy={financeEcosystem} />
          <LandingLegacyCompare copy={landing.legacyCompare} />
          <LandingFeatureSplits copy={landing} />
        </>
      ) : null}

      <footer className="border-t border-[#D5DADF]/80 px-4 py-8">
        <PublicLegalFooter locale={locale} faqHref="/#faq" appPrefix="ERA365" labels={legalLabels} />
      </footer>
    </LandingPageShell>
  );
}

export function SatellitesIndexView({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const landing = useMemo(() => getLandingMarketingCopy(locale), [locale]);
  const index = useMemo(() => getSatellitesIndexCopy(locale), [locale]);
  const legalLabels = FAQ_LABELS[locale] ?? FAQ_LABELS.az;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LandingPageShell>
      <LandingChrome
        hero={landing.hero}
        loginLabel={landing.chrome.login}
        satellitesLabel={landing.chrome.navSatellites}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#34495E] md:text-4xl">{index.title}</h1>
        <p className="mt-3 m-0 max-w-3xl text-[16px] leading-relaxed text-[#7F8C8D]">{index.intro}</p>
        <ul className="mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_SATELLITE_PAGES.map((page) => {
            const pageCopy = getSatellitePageCopy(locale, page.slug);
            const kindLabel =
              page.kind === "core" ? index.coreLabel : page.kind === "platform" ? index.platformLabel : index.industryLabel;
            return (
              <li key={page.slug}>
                <Link
                  href={`/satellites/${page.slug}`}
                  className="flex h-full flex-col rounded-2xl border border-[#D5DADF] bg-white p-4 no-underline shadow-sm hover:border-[#2980B9]/40"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2980B9]">{kindLabel}</span>
                  <h2 className="mt-2 m-0 text-[16px] font-semibold text-[#34495E]">{pageCopy.title}</h2>
                  <p className="mt-2 m-0 flex-1 text-[13px] leading-snug text-[#7F8C8D]">{pageCopy.tagline}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <footer className="border-t border-[#D5DADF]/80 px-4 py-8">
        <PublicLegalFooter locale={locale} faqHref="/#faq" appPrefix="ERA365" labels={legalLabels} />
      </footer>
    </LandingPageShell>
  );
}
