import type { ReactNode } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
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
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Статус" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

type Props = {
  locale: Locale;
  catalog: SiteCatalogResponse;
  labels: SiteNavLabels;
};

export function SiteFooter({ locale, catalog, labels }: Props) {
  const legal = FAQ_LABELS[locale] ?? FAQ_LABELS.az;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#D5DADF]/80 bg-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title={labels.solutions}>
          <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
            {catalog.satellites.slice(0, 10).map((s) => (
              <li key={s.publicSlug}>
                <Link
                  href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
                  className="text-[#34495E] no-underline hover:text-[#2980B9]"
                >
                  {s.name}
                  {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
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
            {catalog.industries.slice(0, 8).map((ind) => (
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
              <Link href={calcPublicHref()} className="text-[#34495E] no-underline hover:text-[#2980B9]">
                {labels.calculator}
              </Link>
            </li>
            <FooterLink locale={locale} href="/pricing" label={labels.pricing} />
            <li>
              <a href={appUrl("/partner")} className="text-[#34495E] no-underline hover:text-[#2980B9]">
                {labels.partner}
              </a>
            </li>
            <FooterLink locale={locale} href="/terms" label={labels.terms} />
          </ul>
        </FooterColumn>

        <FooterColumn title={labels.ctaTrial}>
          <div className="flex flex-col gap-2">
            <a href={appUrl("/register-org")} className={`${PRIMARY_BUTTON_CLASS} text-center text-xs no-underline`}>
              {labels.ctaTrial}
            </a>
            <Link
              href={siteLocalePath(locale, "/demo")}
              className={`${SECONDARY_BUTTON_CLASS} text-center text-xs no-underline`}
            >
              {labels.ctaDemo}
            </Link>
            <Link
              href={calcPublicHref()}
              className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center justify-center gap-1 border-[#2980B9] text-xs text-[#2980B9] no-underline`}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              {labels.calculator}
            </Link>
          </div>
        </FooterColumn>
      </div>

      <div className="border-t border-[#D5DADF]/60 px-4 py-6">
        <p className="text-center text-[12px] text-[#7F8C8D]">© {year} ERA 365</p>
        <PublicLegalFooter
          locale={locale}
          faqHref={siteLocalePath(locale, "/#faq")}
          appPrefix="ERA365"
          labels={legal}
        />
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="m-0 text-sm font-semibold text-[#34495E]">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FooterLink({ locale, href, label }: { locale: Locale; href: string; label: string }) {
  return (
    <li>
      <Link href={siteLocalePath(locale, href)} className="text-[#34495E] no-underline hover:text-[#2980B9]">
        {label}
      </Link>
    </li>
  );
}