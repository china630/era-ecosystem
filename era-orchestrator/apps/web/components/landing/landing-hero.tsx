import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@era/i18n-common";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { siteLocalePath } from "../../lib/site/locale-path";
import { appUrl } from "../../lib/site/site-origins";

export function LandingHero({
  copy,
  calcLabel,
  locale,
}: {
  copy: LandingMarketingCopy["hero"];
  calcLabel?: string;
  locale: Locale;
}) {
  const demoLabel =
    locale === "ru" ? "Запросить демо" : locale === "en" ? "Request a demo" : "Demo sifariş et";

  return (
    <section className="relative px-4 pb-4 pt-6 md:pb-6 md:pt-10">
      <div className="mx-auto max-w-6xl text-center">
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-[#34495E] md:text-5xl lg:text-6xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg font-medium leading-relaxed tracking-wide text-[#7F8C8D] subpixel-antialiased md:text-xl">
          {copy.subtitle}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={appUrl("/register-org")}
              className={`${PRIMARY_BUTTON_CLASS} inline-flex h-11 items-center gap-2 px-6 text-sm no-underline`}
            >
              {copy.ctaPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            {calcLabel ? (
              <Link
                href="/calc"
                className={`${SECONDARY_BUTTON_CLASS} h-11 border-[#2980B9] px-5 text-sm text-[#2980B9] no-underline`}
              >
                {calcLabel}
              </Link>
            ) : (
              <Link
                href={siteLocalePath(locale, "/pricing")}
                className={`${SECONDARY_BUTTON_CLASS} h-11 px-5 text-sm no-underline`}
              >
                {copy.ctaSecondary}
              </Link>
            )}
            <Link
              href={siteLocalePath(locale, "/demo")}
              className="text-sm font-medium text-[#34495E] no-underline hover:text-[#2980B9]"
            >
              {demoLabel}
            </Link>
          </div>
          <p className="m-0 max-w-md text-center text-[11px] font-medium leading-snug tracking-tight text-[#7F8C8D]">
            {copy.ctaMicrocopy}
          </p>
        </div>
      </div>
    </section>
  );
}
