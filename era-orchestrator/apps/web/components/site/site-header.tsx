"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { Calculator, ChevronDown, Menu, X } from "lucide-react";
import type { Locale } from "@era/i18n-common";
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import type { SiteNavLabels } from "../../lib/i18n/site-nav-copy";
import { track } from "../../lib/analytics/track";
import { appUrl } from "../../lib/site/site-origins";
import { siteLocalePath } from "../../lib/site/locale-path";
import type { PublicSiteIndustry, SiteCatalogResponse } from "../../lib/site/site-catalog-types";
import { calcHrefForIndustry, calcPublicHref } from "../../lib/site/calc-href-for-industry";
import { PilotBadge } from "./pilot-badge";
import { SiteLocaleLinks } from "./site-locale-links";

type Props = {
  locale: Locale;
  catalog: SiteCatalogResponse;
  labels: SiteNavLabels;
};

type DesktopMenu = "solutions" | "industries" | "resources" | null;
type MobileSection = "solutions" | "industries" | "resources" | null;

function groupSatellites(catalog: SiteCatalogResponse) {
  const core = catalog.satellites.filter((s) => s.kind === "core" || s.kind === "platform");
  const industry = catalog.satellites.filter((s) => s.kind === "industry");
  return { core, industry };
}

export function SiteHeader({ locale, catalog, labels }: Props) {
  const [openMenu, setOpenMenu] = useState<DesktopMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(
    catalog.industries[0]?.slug ?? null,
  );
  const menuId = useId();
  const mobilePanelId = useId();
  const { core, industry } = groupSatellites(catalog);
  const previewIndustry =
    catalog.industries.find((i) => i.slug === previewSlug) ?? catalog.industries[0] ?? null;

  const closeMenus = useCallback(() => setOpenMenu(null), []);
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setMobileSection(null);
  }, []);

  const toggle = (key: DesktopMenu) => {
    setOpenMenu((prev) => (prev === key ? null : key));
    if (key) track("nav_menu_open", { menu: key });
  };

  const toggleMobileSection = (key: MobileSection) => {
    setMobileSection((prev) => (prev === key ? null : key));
    if (key) track("nav_menu_open", { menu: `mobile_${key}` });
  };

  const calcHref = calcPublicHref();

  return (
    <header className="sticky top-0 z-30 border-b border-[#D5DADF]/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link
          href={siteLocalePath(locale, "/")}
          className="text-lg font-bold tracking-tight text-[#34495E] no-underline"
          onClick={closeMobile}
        >
          ERA 365
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex lg:gap-2" aria-label="Main">
          <NavDrop
            id={`${menuId}-solutions`}
            open={openMenu === "solutions"}
            label={labels.solutions}
            onToggle={() => toggle("solutions")}
            onClose={closeMenus}
            panelClassName="left-0 w-[min(100vw-2rem,42rem)]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <PanelSection title={labels.platformCore}>
                <ul className="m-0 list-none space-y-1 p-0">
                  {core.map((s) => (
                    <li key={s.publicSlug}>
                      <Link
                        href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                        onClick={() =>
                          track("nav_item_click", { menu: "solutions", item: s.publicSlug })
                        }
                      >
                        <span>{s.name}</span>
                        {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </PanelSection>
              <PanelSection title={labels.industryProducts}>
                <ul className="m-0 max-h-48 list-none space-y-1 overflow-y-auto p-0">
                  {industry.map((s) => (
                    <li key={s.publicSlug}>
                      <Link
                        href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                        onClick={() =>
                          track("nav_item_click", { menu: "solutions", item: s.publicSlug })
                        }
                      >
                        <span>{s.name}</span>
                        {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D5DADF]/80 pt-3">
              <Link
                href={siteLocalePath(locale, "/satellites")}
                className="text-sm font-medium text-[#2980B9] no-underline hover:text-[#2471A3]"
              >
                {labels.allSolutions}
              </Link>
              <CalcTeaser href={calcHref} labels={labels} location="megamenu_solutions" />
            </div>
          </NavDrop>

          <NavDrop
            id={`${menuId}-industries`}
            open={openMenu === "industries"}
            label={labels.industries}
            onToggle={() => toggle("industries")}
            onClose={closeMenus}
            panelClassName="left-0 w-[min(100vw-2rem,48rem)]"
          >
            <div className="grid gap-4 md:grid-cols-[1fr,1.1fr]">
              <ul className="m-0 max-h-56 list-none space-y-0.5 overflow-y-auto p-0">
                {catalog.industries.map((ind) => (
                  <li key={ind.slug}>
                    <Link
                      href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                      className="flex items-center rounded-lg px-2 py-1.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                      onMouseEnter={() => {
                        setPreviewSlug(ind.slug);
                        track("nav_bundle_preview", { industry: ind.slug });
                      }}
                      onFocus={() => setPreviewSlug(ind.slug)}
                      onClick={() =>
                        track("nav_item_click", { menu: "industries", item: ind.slug })
                      }
                    >
                      <span>{ind.name}</span>
                      {ind.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {previewIndustry ? (
                <IndustryIncludesPreview
                  industry={previewIndustry}
                  locale={locale}
                  labels={labels}
                />
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D5DADF]/80 pt-3">
              <Link
                href={siteLocalePath(locale, "/industries")}
                className="text-sm font-medium text-[#2980B9] no-underline hover:text-[#2471A3]"
              >
                {labels.allIndustries}
              </Link>
              <CalcTeaser
                href={
                  previewIndustry
                    ? calcHrefForIndustry(locale, previewIndustry)
                    : calcHref
                }
                labels={labels}
                location="megamenu_industries"
              />
            </div>
          </NavDrop>

          <Link
            href={siteLocalePath(locale, "/pricing")}
            className={`${GHOST_BUTTON_CLASS} text-xs no-underline`}
          >
            {labels.pricing}
          </Link>

          <NavDrop
            id={`${menuId}-resources`}
            open={openMenu === "resources"}
            label={labels.resources}
            onToggle={() => toggle("resources")}
            onClose={closeMenus}
            panelClassName="right-0 w-56"
          >
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              <ResourceLink locale={locale} href="/help" label={labels.faq} menu="resources" />
              <li>
                <Link
                  href={calcHref}
                  className="block rounded-lg px-2 py-1.5 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                  onClick={() => track("nav_item_click", { menu: "resources", item: "/calc" })}
                >
                  {labels.calculator}
                </Link>
              </li>
              <ResourceLink locale={locale} href="/pricing" label={labels.pricing} menu="resources" />
              <li>
                <a
                  href={appUrl("/partner")}
                  className="block rounded-lg px-2 py-1.5 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                >
                  {labels.partner}
                </a>
              </li>
              <ResourceLink locale={locale} href="/demo" label={labels.ctaDemo} menu="resources" />
              <ResourceLink locale={locale} href="/contact" label={labels.contact} menu="resources" />
              <ResourceLink locale={locale} href="/terms" label={labels.terms} menu="resources" />
            </ul>
          </NavDrop>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden md:contents">
            <SiteLocaleLinks locale={locale} />
            <Link
              href={calcHref}
              className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center gap-1.5 border-[#2980B9] text-xs text-[#2980B9] no-underline`}
              onClick={() => track("cta_calc_click", { location: "header" })}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              {labels.calculator}
            </Link>
            <a
              href={appUrl("/login")}
              className={`${GHOST_BUTTON_CLASS} hidden text-xs no-underline sm:inline-flex`}
              onClick={() => track("cta_login_click", { location: "header" })}
            >
              {labels.login}
            </a>
            <Link
              href={siteLocalePath(locale, "/demo")}
              className={`${SECONDARY_BUTTON_CLASS} hidden text-xs no-underline md:inline-flex`}
              onClick={() => track("cta_demo_click", { location: "header" })}
            >
              {labels.ctaDemo}
            </Link>
            <a
              href={appUrl("/register-org")}
              className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}
              onClick={() => track("cta_trial_click", { location: "header" })}
            >
              {labels.ctaTrial}
            </a>
          </div>

          <button
            type="button"
            className={`${GHOST_BUTTON_CLASS} inline-flex items-center justify-center p-2 md:hidden`}
            aria-expanded={mobileOpen}
            aria-controls={mobilePanelId}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => {
              setMobileOpen((v) => !v);
              setOpenMenu(null);
              track("nav_menu_open", { menu: "mobile_burger" });
            }}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id={mobilePanelId}
          className="border-t border-[#D5DADF]/80 bg-white md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto max-h-[min(80vh,40rem)] max-w-6xl space-y-1 overflow-y-auto px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <SiteLocaleLinks locale={locale} />
            </div>

            <MobileAccordion
              id={`${menuId}-m-solutions`}
              label={labels.solutions}
              open={mobileSection === "solutions"}
              onToggle={() => toggleMobileSection("solutions")}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                {labels.platformCore}
              </p>
              <ul className="m-0 mb-3 list-none space-y-1 p-0">
                {core.map((s) => (
                  <li key={s.publicSlug}>
                    <Link
                      href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                      onClick={() => {
                        track("nav_item_click", { menu: "mobile_solutions", item: s.publicSlug });
                        closeMobile();
                      }}
                    >
                      <span>{s.name}</span>
                      {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                {labels.industryProducts}
              </p>
              <ul className="m-0 list-none space-y-1 p-0">
                {industry.map((s) => (
                  <li key={s.publicSlug}>
                    <Link
                      href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                      onClick={() => {
                        track("nav_item_click", { menu: "mobile_solutions", item: s.publicSlug });
                        closeMobile();
                      }}
                    >
                      <span>{s.name}</span>
                      {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={siteLocalePath(locale, "/satellites")}
                className="mt-3 inline-block text-sm font-medium text-[#2980B9] no-underline"
                onClick={closeMobile}
              >
                {labels.allSolutions}
              </Link>
            </MobileAccordion>

            <MobileAccordion
              id={`${menuId}-m-industries`}
              label={labels.industries}
              open={mobileSection === "industries"}
              onToggle={() => toggleMobileSection("industries")}
            >
              <ul className="m-0 list-none space-y-1 p-0">
                {catalog.industries.map((ind) => (
                  <li key={ind.slug}>
                    <Link
                      href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                      onClick={() => {
                        setPreviewSlug(ind.slug);
                        track("nav_item_click", { menu: "mobile_industries", item: ind.slug });
                        closeMobile();
                      }}
                    >
                      <span>{ind.name}</span>
                      {ind.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {previewIndustry ? (
                <div className="mt-3">
                  <IndustryIncludesPreview
                    industry={previewIndustry}
                    locale={locale}
                    labels={labels}
                  />
                </div>
              ) : null}
              <Link
                href={siteLocalePath(locale, "/industries")}
                className="mt-3 inline-block text-sm font-medium text-[#2980B9] no-underline"
                onClick={closeMobile}
              >
                {labels.allIndustries}
              </Link>
            </MobileAccordion>

            <Link
              href={siteLocalePath(locale, "/pricing")}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-[#34495E] no-underline hover:bg-[#EBEDF0]"
              onClick={closeMobile}
            >
              {labels.pricing}
            </Link>

            <MobileAccordion
              id={`${menuId}-m-resources`}
              label={labels.resources}
              open={mobileSection === "resources"}
              onToggle={() => toggleMobileSection("resources")}
            >
              <ul className="m-0 list-none space-y-1 p-0 text-sm">
                <ResourceLink locale={locale} href="/help" label={labels.faq} menu="mobile_resources" onNavigate={closeMobile} />
                <li>
                  <Link
                    href={calcHref}
                    className="block rounded-lg px-2 py-1.5 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={() => {
                      track("nav_item_click", { menu: "mobile_resources", item: "/calc" });
                      closeMobile();
                    }}
                  >
                    {labels.calculator}
                  </Link>
                </li>
                <ResourceLink locale={locale} href="/pricing" label={labels.pricing} menu="mobile_resources" onNavigate={closeMobile} />
                <li>
                  <a
                    href={appUrl("/partner")}
                    className="block rounded-lg px-2 py-1.5 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={closeMobile}
                  >
                    {labels.partner}
                  </a>
                </li>
                <ResourceLink locale={locale} href="/demo" label={labels.ctaDemo} menu="mobile_resources" onNavigate={closeMobile} />
                <ResourceLink locale={locale} href="/contact" label={labels.contact} menu="mobile_resources" onNavigate={closeMobile} />
                <ResourceLink locale={locale} href="/terms" label={labels.terms} menu="mobile_resources" onNavigate={closeMobile} />
              </ul>
            </MobileAccordion>

            <div className="mt-3 flex flex-col gap-2 border-t border-[#D5DADF]/80 pt-3">
              <Link
                href={calcHref}
                className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center justify-center gap-1.5 border-[#2980B9] text-sm text-[#2980B9] no-underline`}
                onClick={() => {
                  track("cta_calc_click", { location: "mobile_header" });
                  closeMobile();
                }}
              >
                <Calculator className="h-4 w-4" aria-hidden />
                {labels.calculator}
              </Link>
              <Link
                href={siteLocalePath(locale, "/demo")}
                className={`${SECONDARY_BUTTON_CLASS} text-center text-sm no-underline`}
                onClick={() => {
                  track("cta_demo_click", { location: "mobile_header" });
                  closeMobile();
                }}
              >
                {labels.ctaDemo}
              </Link>
              <a
                href={appUrl("/login")}
                className={`${GHOST_BUTTON_CLASS} text-center text-sm no-underline`}
                onClick={() => {
                  track("cta_login_click", { location: "mobile_header" });
                  closeMobile();
                }}
              >
                {labels.login}
              </a>
              <a
                href={appUrl("/register-org")}
                className={`${PRIMARY_BUTTON_CLASS} text-center text-sm no-underline`}
                onClick={() => {
                  track("cta_trial_click", { location: "mobile_header" });
                  closeMobile();
                }}
              >
                {labels.ctaTrial}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MobileAccordion({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#D5DADF]/70">
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-[#34495E]"
        onClick={onToggle}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div id={`${id}-panel`} role="region" aria-labelledby={id} className="border-t border-[#D5DADF]/60 px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function NavDrop({
  id,
  label,
  open,
  onToggle,
  onClose,
  panelClassName,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  panelClassName: string;
  children: ReactNode;
}) {
  return (
    <div className="relative" onMouseLeave={onClose}>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-haspopup="true"
        className={`${GHOST_BUTTON_CLASS} inline-flex items-center gap-1 text-xs`}
        onClick={onToggle}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          role="region"
          aria-labelledby={id}
          className={`absolute top-full z-40 mt-2 rounded-2xl border border-[#D5DADF]/90 bg-white p-4 shadow-lg ${panelClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function IndustryIncludesPreview({
  industry,
  locale,
  labels,
}: {
  industry: PublicSiteIndustry;
  locale: Locale;
  labels: SiteNavLabels;
}) {
  return (
    <div className="rounded-xl border border-[#D5DADF]/80 bg-[#EBEDF0]/40 p-3">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
        {labels.includes}
      </p>
      <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
        {industry.items.map((item) => (
          <li key={`${item.satelliteKey}-${item.moduleKey ?? "gate"}`}>
            {item.publicSlug ? (
              <Link
                href={siteLocalePath(locale, `/satellites/${item.publicSlug}`)}
                className="inline-flex items-center rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-2.5 py-0.5 text-[11px] font-medium text-[#2471A3] no-underline"
              >
                {item.name}
                {item.maturity === "pilot" ? (
                  <span className="ml-1 opacity-80">· {labels.pilot}</span>
                ) : null}
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#D5DADF] bg-white px-2.5 py-0.5 text-[11px] text-[#34495E]">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalcTeaser({
  href,
  labels,
  location,
}: {
  href: string;
  labels: SiteNavLabels;
  location: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[#2980B9]/30 bg-[#EBF5FB] px-3 py-2 text-xs no-underline"
      onClick={() => track("cta_calc_click", { location })}
    >
      <span className="block font-semibold text-[#34495E]">{labels.calcCardTitle}</span>
      <span className="mt-0.5 inline-flex items-center gap-1 text-[#2980B9]">
        <Calculator className="h-3 w-3" aria-hidden />
        {labels.calcCardCta}
      </span>
    </Link>
  );
}

function ResourceLink({
  locale,
  href,
  label,
  menu,
  onNavigate,
}: {
  locale: Locale;
  href: string;
  label: string;
  menu: string;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={siteLocalePath(locale, href)}
        className="block rounded-lg px-2 py-1.5 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
        onClick={() => {
          track("nav_item_click", { menu, item: href });
          onNavigate?.();
        }}
      >
        {label}
      </Link>
    </li>
  );
}