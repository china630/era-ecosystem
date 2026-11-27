"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Calculator, ChevronDown, Menu, X } from "lucide-react";
import type { Locale } from "@era/i18n-common";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import type { SiteNavLabels } from "../../lib/i18n/site-nav-copy";
import { track } from "../../lib/analytics/track";
import { appUrl } from "../../lib/site/site-origins";
import { siteLocalePath } from "../../lib/site/locale-path";
import type {
  PublicSiteIndustry,
  PublicSiteSatellite,
  SiteCatalogResponse,
} from "../../lib/site/site-catalog-types";
import { calcHrefForIndustry, calcPublicHref } from "../../lib/site/calc-href-for-industry";
import { siteProductIcon } from "../../lib/site/site-product-icons";
import { PilotBadge } from "./pilot-badge";
import { SiteLocaleLinks } from "./site-locale-links";

type Props = {
  locale: Locale;
  catalog: SiteCatalogResponse;
  labels: SiteNavLabels;
};

type DesktopMenu = "solutions" | "industries" | "resources" | null;
type MobileSection = "solutions" | "industries" | "resources" | null;

const CLOSE_DELAY_MS = 180;
const NAV_LINK =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[14px] font-medium text-[#34495E] no-underline hover:text-[#2980B9]";
const NAV_LINK_OPEN = "text-[#2980B9]";

function groupSatellites(catalog: SiteCatalogResponse) {
  const core = catalog.satellites.filter((s) => s.kind === "core" || s.kind === "platform");
  const industry = catalog.satellites.filter((s) => s.kind === "industry");
  return { core, industry };
}

function oneLine(text: string | null | undefined): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { core, industry } = groupSatellites(catalog);
  const previewIndustry =
    catalog.industries.find((i) => i.slug === previewSlug) ?? catalog.industries[0] ?? null;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeMenus = useCallback(() => {
    clearCloseTimer();
    setOpenMenu(null);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenMenu(null), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const openDesktop = useCallback(
    (key: DesktopMenu) => {
      clearCloseTimer();
      setOpenMenu(key);
      if (key) track("nav_menu_open", { menu: key });
    },
    [clearCloseTimer],
  );

  const toggleDesktop = useCallback(
    (key: DesktopMenu) => {
      clearCloseTimer();
      setOpenMenu((prev) => {
        const next = prev === key ? null : key;
        if (next) track("nav_menu_open", { menu: next });
        return next;
      });
    },
    [clearCloseTimer],
  );

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setMobileSection(null);
  }, []);

  useEffect(() => {
    if (!openMenu && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeMenus();
      closeMobile();
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        closeMenus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openMenu, mobileOpen, closeMenus, closeMobile]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const calcHref = calcPublicHref();

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b border-[#D5DADF]/80 bg-white/90 backdrop-blur-md"
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:gap-4">
        <Link
          href={siteLocalePath(locale, "/")}
          className="shrink-0 text-lg font-bold tracking-tight text-[#34495E] no-underline"
          onClick={closeMobile}
        >
          ERA 365
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex"
          aria-label="Main"
          onMouseLeave={scheduleClose}
          onMouseEnter={clearCloseTimer}
        >
          <MegaTrigger
            id={`${menuId}-solutions`}
            open={openMenu === "solutions"}
            label={labels.solutions}
            onOpen={() => openDesktop("solutions")}
            onToggle={() => toggleDesktop("solutions")}
          />
          <MegaTrigger
            id={`${menuId}-industries`}
            open={openMenu === "industries"}
            label={labels.industries}
            onOpen={() => openDesktop("industries")}
            onToggle={() => toggleDesktop("industries")}
          />
          <Link href={siteLocalePath(locale, "/pricing")} className={NAV_LINK}>
            {labels.pricing}
          </Link>
          <MegaTrigger
            id={`${menuId}-resources`}
            open={openMenu === "resources"}
            label={labels.resources}
            onOpen={() => openDesktop("resources")}
            onToggle={() => toggleDesktop("resources")}
          />

        </nav>

        {openMenu === "solutions" ? (
          <MegaPanel
            labelledBy={`${menuId}-solutions`}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr_0.85fr]">
              <PanelSection title={labels.platformCore}>
                <ProductList locale={locale} items={core} labels={labels} menu="solutions" />
              </PanelSection>
              <PanelSection title={labels.industryProducts}>
                <ProductList locale={locale} items={industry} labels={labels} menu="solutions" />
              </PanelSection>
              <CalcPromo href={calcHref} labels={labels} location="megamenu_solutions" />
            </div>
            <div className="mt-5 border-t border-[#D5DADF]/80 pt-3">
              <Link
                href={siteLocalePath(locale, "/satellites")}
                className="text-sm font-medium text-[#2980B9] no-underline hover:text-[#2471A3]"
              >
                {labels.allSolutions}
              </Link>
            </div>
          </MegaPanel>
        ) : null}

        {openMenu === "industries" ? (
          <MegaPanel
            labelledBy={`${menuId}-industries`}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr_0.85fr]">
              <PanelSection title={labels.industries}>
                <ul className="m-0 grid list-none gap-0.5 p-0 sm:grid-cols-2">
                  {catalog.industries.map((ind) => (
                    <li key={ind.slug}>
                      <Link
                        href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm no-underline ${
                          previewSlug === ind.slug
                            ? "bg-[#EBF5FB] text-[#2980B9]"
                            : "text-[#34495E] hover:bg-[#EBEDF0]"
                        }`}
                        onMouseEnter={() => {
                          setPreviewSlug(ind.slug);
                          track("nav_bundle_preview", { industry: ind.slug });
                        }}
                        onFocus={() => setPreviewSlug(ind.slug)}
                        onClick={() =>
                          track("nav_item_click", { menu: "industries", item: ind.slug })
                        }
                      >
                        <span className="font-medium">{ind.name}</span>
                        {ind.maturity === "pilot" || ind.maturity === "in_development" ? (
                          <PilotBadge label={labels.pilot} />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </PanelSection>
              {previewIndustry ? (
                <IndustryBundle industry={previewIndustry} locale={locale} labels={labels} />
              ) : (
                <div />
              )}
              <CalcPromo
                href={
                  previewIndustry
                    ? calcHrefForIndustry(locale, previewIndustry)
                    : calcHref
                }
                labels={labels}
                location="megamenu_industries"
              />
            </div>
            <div className="mt-5 border-t border-[#D5DADF]/80 pt-3">
              <Link
                href={siteLocalePath(locale, "/industries")}
                className="text-sm font-medium text-[#2980B9] no-underline hover:text-[#2471A3]"
              >
                {labels.allIndustries}
              </Link>
            </div>
          </MegaPanel>
        ) : null}

        {openMenu === "resources" ? (
          <MegaPanel
            labelledBy={`${menuId}-resources`}
            narrow
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <ul className="m-0 list-none space-y-0.5 p-0 text-sm">
              <ResourceItem locale={locale} href="/help" label={labels.faq} />
              <li>
                <a
                  href={appUrl("/partner")}
                  className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                >
                  {labels.partner}
                </a>
              </li>
              <ResourceItem locale={locale} href="/contact" label={labels.contact} />
              <ResourceItem locale={locale} href="/terms" label={labels.terms} />
            </ul>
          </MegaPanel>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <SiteLocaleLinks locale={locale} />
            <a
              href={appUrl("/login")}
              className="px-1 text-[14px] font-medium text-[#34495E] no-underline hover:text-[#2980B9]"
              onClick={() => track("cta_login_click", { location: "header" })}
            >
              {labels.login}
            </a>
            <Link
              href={calcHref}
              className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center gap-1.5 border-[#2980B9] text-xs text-[#2980B9] no-underline`}
              onClick={() => track("cta_calc_click", { location: "header" })}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              {labels.calculator}
            </Link>
            <a
              href={appUrl("/register-org")}
              className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}
              onClick={() => track("cta_trial_click", { location: "header" })}
            >
              {labels.ctaTrial}
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <SiteLocaleLinks locale={locale} />
            <a
              href={appUrl("/register-org")}
              className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}
              onClick={() => track("cta_trial_click", { location: "header_mobile" })}
            >
              {labels.ctaTrial}
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-[#D5DADF] p-2 text-[#34495E]"
              aria-expanded={mobileOpen}
              aria-controls={mobilePanelId}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => {
                setMobileOpen((v) => !v);
                closeMenus();
                track("nav_menu_open", { menu: "mobile_burger" });
              }}
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id={mobilePanelId}
          className="border-t border-[#D5DADF]/80 bg-white lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto max-h-[min(80vh,40rem)] max-w-6xl space-y-1 overflow-y-auto px-4 py-3">
            <MobileAccordion
              label={labels.solutions}
              open={mobileSection === "solutions"}
              onToggle={() =>
                setMobileSection((p) => (p === "solutions" ? null : "solutions"))
              }
            >
              <ProductList
                locale={locale}
                items={[...core, ...industry]}
                labels={labels}
                menu="mobile_solutions"
                onNavigate={closeMobile}
              />
            </MobileAccordion>
            <MobileAccordion
              label={labels.industries}
              open={mobileSection === "industries"}
              onToggle={() =>
                setMobileSection((p) => (p === "industries" ? null : "industries"))
              }
            >
              <ul className="m-0 list-none space-y-1 p-0">
                {catalog.industries.map((ind) => (
                  <li key={ind.slug}>
                    <Link
                      href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                      className="block rounded-lg px-2 py-2 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                      onClick={closeMobile}
                    >
                      {ind.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </MobileAccordion>
            <Link
              href={siteLocalePath(locale, "/pricing")}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-[#34495E] no-underline hover:bg-[#EBEDF0]"
              onClick={closeMobile}
            >
              {labels.pricing}
            </Link>
            <Link
              href={calcHref}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-[#2980B9] no-underline hover:bg-[#EBF5FB]"
              onClick={closeMobile}
            >
              {labels.calculator}
            </Link>
            <MobileAccordion
              label={labels.resources}
              open={mobileSection === "resources"}
              onToggle={() =>
                setMobileSection((p) => (p === "resources" ? null : "resources"))
              }
            >
              <ul className="m-0 list-none space-y-1 p-0 text-sm">
                <li>
                  <Link
                    href={siteLocalePath(locale, "/help")}
                    className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={closeMobile}
                  >
                    {labels.faq}
                  </Link>
                </li>
                <li>
                  <a
                    href={appUrl("/partner")}
                    className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={closeMobile}
                  >
                    {labels.partner}
                  </a>
                </li>
                <li>
                  <Link
                    href={siteLocalePath(locale, "/contact")}
                    className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={closeMobile}
                  >
                    {labels.contact}
                  </Link>
                </li>
                <li>
                  <Link
                    href={siteLocalePath(locale, "/terms")}
                    className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                    onClick={closeMobile}
                  >
                    {labels.terms}
                  </Link>
                </li>
              </ul>
            </MobileAccordion>
            <a
              href={appUrl("/login")}
              className="block rounded-lg px-2 py-2.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
              onClick={closeMobile}
            >
              {labels.login}
            </a>
            <Link
              href={siteLocalePath(locale, "/demo")}
              className="block rounded-lg px-2 py-2.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
              onClick={closeMobile}
            >
              {labels.ctaDemo}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MegaTrigger({
  id,
  open,
  label,
  onOpen,
  onToggle,
}: {
  id: string;
  open: boolean;
  label: string;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      className={`${NAV_LINK} ${open ? NAV_LINK_OPEN : ""} cursor-pointer border-0 bg-transparent`}
      aria-expanded={open}
      aria-haspopup="true"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      onClick={onToggle}
    >
      {label}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}

function MegaPanel({
  labelledBy,
  children,
  narrow,
  onMouseEnter,
  onMouseLeave,
}: {
  labelledBy: string;
  children: ReactNode;
  narrow?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      className="absolute inset-x-0 top-full z-40 hidden lg:block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Hover bridge: padding catches pointer events (no mt-* gap). */}
      <div className="px-4 pt-2">
        <div
          className={`rounded-2xl border border-[#D5DADF]/90 bg-white px-6 py-5 shadow-[0_12px_40px_rgba(52,73,94,0.08)] ${
            narrow ? "ml-auto w-[min(100%,16rem)]" : "w-full"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
        {title}
      </p>
      {children}
    </div>
  );
}

function ProductList({
  locale,
  items,
  labels,
  menu,
  onNavigate,
}: {
  locale: Locale;
  items: PublicSiteSatellite[];
  labels: SiteNavLabels;
  menu: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="m-0 list-none space-y-0.5 p-0">
      {items.map((s) => {
        const Icon = siteProductIcon(s.publicSlug);
        const blurb = oneLine(s.tagline || s.description);
        return (
          <li key={s.publicSlug}>
            <Link
              href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
              className="flex items-start gap-3 rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
              onClick={() => {
                track("nav_item_click", { menu, item: s.publicSlug });
                onNavigate?.();
              }}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EBF5FB] text-[#2980B9]">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {s.name}
                  {s.maturity === "pilot" || s.maturity === "in_development" ? (
                    <PilotBadge label={labels.pilot} />
                  ) : null}
                </span>
                {blurb ? (
                  <span className="mt-0.5 block truncate text-[12px] text-[#7F8C8D]">
                    {blurb}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function IndustryBundle({
  industry,
  locale,
  labels,
}: {
  industry: PublicSiteIndustry;
  locale: Locale;
  labels: SiteNavLabels;
}) {
  return (
    <PanelSection title={labels.includes}>
      <ul className="m-0 list-none space-y-1 p-0">
        {industry.items.slice(0, 6).map((item) => {
          const Icon = siteProductIcon(item.publicSlug ?? item.satelliteKey);
          return (
            <li key={`${item.satelliteKey}-${item.moduleKey ?? ""}`}>
              {item.publicSlug ? (
                <Link
                  href={siteLocalePath(locale, `/satellites/${item.publicSlug}`)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#34495E] no-underline hover:bg-[#EBEDF0]"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#EBEDF0] text-[#2980B9]">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>{item.name}</span>
                  {item.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#34495E]">
                  {item.name}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}

function CalcPromo({
  href,
  labels,
  location,
}: {
  href: string;
  labels: SiteNavLabels;
  location: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#2980B9]/30 bg-[#EBF5FB] p-4">
      <div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2980B9]">
          <Calculator className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 m-0 text-sm font-semibold text-[#34495E]">{labels.calcCardTitle}</p>
      </div>
      <Link
        href={href}
        className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-flex justify-center text-center text-xs no-underline`}
        onClick={() => track("cta_calc_click", { location })}
      >
        {labels.calcCardCta}
      </Link>
    </div>
  );
}

function ResourceItem({
  locale,
  href,
  label,
}: {
  locale: Locale;
  href: string;
  label: string;
}) {
  return (
    <li>
      <Link
        href={siteLocalePath(locale, href)}
        className="block rounded-lg px-2 py-2 text-[#34495E] no-underline hover:bg-[#EBEDF0]"
      >
        {label}
      </Link>
    </li>
  );
}

function MobileAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#EBEDF0] pb-1">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm font-medium text-[#34495E]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="pb-2 pl-1">{children}</div> : null}
    </div>
  );
}
