import type { ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "@era/i18n-common";
import { PRIMARY_BUTTON_CLASS, PublicLegalFooter, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import type { SiteNavLabels } from "../../lib/i18n/site-nav-copy";
import { appUrl } from "../../lib/site/site-origins";
import { calcPublicHref } from "../../lib/site/calc-href-for-industry";
import { siteLocalePath } from "../../lib/site/locale-path";
import type { SiteCatalogResponse } from "../../lib/site/site-catalog-types";
import { PilotBadge } from "./pilot-badge";

const FAQ_LABELS = {
  az: { navAria: "Hüquqi keçidlər", faq: "FAQ", terms: "Şərtlər", privacy: "Məxfilik", status: "Status" },
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Status" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

type SiteContactExtras = {
  address?: string | null;
  legalName?: string | null;
  voen?: string | null;
};

type Props = {
  locale: Locale;
  catalog: SiteCatalogResponse;
  labels: SiteNavLabels;
  /** Optional legal block — hidden when all empty. */
  contactExtras?: SiteContactExtras;
};

export function SiteFooter({ locale, catalog, labels, contactExtras }: Props) {
  const legal = FAQ_LABELS[locale] ?? FAQ_LABELS.az;
  const year = new Date().getFullYear();
  const phoneDisplay = catalog.contact?.phoneDisplay ?? "+994 77 350 70 70";
  const phoneTel = catalog.contact?.phoneE164 ?? "+994773507070";
  const whatsapp =
    catalog.contact?.whatsappUrl ?? "https://wa.me/994773507070";
  const email = catalog.contact?.email ?? "chingiz@era-365.online";
  const address = contactExtras?.address ?? catalog.contact?.address;
  const legalName = contactExtras?.legalName ?? catalog.contact?.legalName;
  const voen = contactExtras?.voen ?? catalog.contact?.voen;
  const showLegalBlock = Boolean(
    address?.trim() || legalName?.trim() || voen?.trim(),
  );
  const contactTitle =
    locale === "ru" ? "Контакты / начать" : locale === "en" ? "Contact / get started" : "Əlaqə / başla";

  return (
    <footer className="border-t border-[#D5DADF]/80 bg-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title={labels.solutions}>
          <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
            {catalog.satellites.map((s) => (
              <li key={s.publicSlug}>
                <Link
                  href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                  className="text-[#34495E] no-underline hover:text-[#2980B9]"
                >
                  {s.name}
                  {s.maturity === "pilot" || s.maturity === "in_development" ? (
                    <PilotBadge label={labels.pilot} />
                  ) : null}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={siteLocalePath(locale, "/satellites")}
                className="font-medium text-[#2980B9] no-underline"
              >
                {labels.allSolutions}
              </Link>
            </li>
          </ul>
        </FooterColumn>

        <FooterColumn title={labels.industries}>
          <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
            {catalog.industries.map((ind) => (
              <li key={ind.slug}>
                <Link
                  href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                  className="text-[#34495E] no-underline hover:text-[#2980B9]"
                >
                  {ind.name}
                  {ind.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={siteLocalePath(locale, "/industries")}
                className="font-medium text-[#2980B9] no-underline"
              >
                {labels.allIndustries}
              </Link>
            </li>
          </ul>
        </FooterColumn>

        <FooterColumn title={labels.resources}>
          <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
            <FooterLink locale={locale} href="/help" label={labels.faq} />
            <li>
              <a href={appUrl("/partner")} className="text-[#34495E] no-underline hover:text-[#2980B9]">
                {labels.partner}
              </a>
            </li>
            <FooterLink locale={locale} href="/contact" label={labels.contact} />
            <FooterLink locale={locale} href="/terms" label={labels.terms} />
            <FooterLink locale={locale} href="/pricing" label={labels.pricing} />
          </ul>
        </FooterColumn>

        <FooterColumn title={contactTitle}>
          <ul className="m-0 mb-3 list-none space-y-1.5 p-0 text-sm text-[#34495E]">
            <li>
              <a href={`tel:${phoneTel}`} className="no-underline hover:text-[#2980B9]">
                {phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={whatsapp}
                className="no-underline hover:text-[#2980B9]"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`} className="no-underline hover:text-[#2980B9]">
                {email}
              </a>
            </li>
            {showLegalBlock ? (
              <>
                {legalName?.trim() ? <li>{legalName}</li> : null}
                {voen?.trim() ? <li>VÖEN {voen}</li> : null}
                {address?.trim() ? <li>{address}</li> : null}
              </>
            ) : null}
          </ul>
          <div className="flex flex-col gap-2">
            <a
              href={appUrl("/register-org")}
              className={`${PRIMARY_BUTTON_CLASS} text-center text-xs no-underline`}
            >
              {labels.ctaTrial}
            </a>
            <Link
              href={siteLocalePath(locale, "/demo")}
              className="text-center text-sm font-medium text-[#34495E] no-underline hover:text-[#2980B9]"
            >
              {labels.ctaDemo}
            </Link>
            <Link
              href={calcPublicHref()}
              className={`${SECONDARY_BUTTON_CLASS} text-center text-xs text-[#2980B9] no-underline`}
            >
              {labels.calculator}
            </Link>
          </div>
        </FooterColumn>
      </div>

      <div className="border-t border-[#EBEDF0]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-[#7F8C8D] sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} ERA 365</span>
          <PublicLegalFooter
            locale={locale}
            labels={{
              navAria: legal.navAria,
              faq: legal.faq,
              terms: legal.terms,
              privacy: legal.privacy,
              status: legal.status,
            }}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#34495E]">{title}</p>
      {children}
    </div>
  );
}

function FooterLink({
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
        className="text-[#34495E] no-underline hover:text-[#2980B9]"
      >
        {label}
      </Link>
    </li>
  );
}
