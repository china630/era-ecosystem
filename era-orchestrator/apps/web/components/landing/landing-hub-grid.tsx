import Link from "next/link";
import {
  BedDouble,
  Building2,
  Calculator,
  Landmark,
  MessageCircle,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  Warehouse,
  BookOpen,
  Globe2,
  type LucideIcon,
} from "lucide-react";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingHubCopy } from "../../lib/i18n/landing-marketing-copy";
import type { PublicSatelliteSlug } from "../../lib/satellites/public-satellite-catalog";

const ICONS: Record<string, LucideIcon> = {
  finance: BookOpen,
  hotel: BedDouble,
  clinic: Stethoscope,
  fnb: UtensilsCrossed,
  retail: Store,
  auto: Wrench,
  logistics: Truck,
  construction: Building2,
  wholesale: Warehouse,
  crm: MessageCircle,
  banking: Landmark,
  "data-hub": Globe2,
  addons: Calculator,
};

type HubCard = {
  slug: PublicSatelliteSlug;
  title: string;
  body: string;
  href: string;
  priceLabel?: string;
};

export function LandingHubGrid({
  hub,
  satellites,
  addonsHref = "/pricing#addons",
}: {
  hub: LandingHubCopy;
  satellites: HubCard[];
  addonsHref?: string;
}) {
  const core = satellites.find((s) => s.slug === "finance");
  const dataHub = satellites.find((s) => s.slug === "data-hub");
  const industry = satellites.filter((s) => s.slug !== "finance" && s.slug !== "data-hub");

  return (
    <section className="w-full px-4 py-10 md:py-14" aria-labelledby="landing-hub-title">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-4 md:grid-cols-2">
          {core ? <FeatureCard icon="finance" title={hub.coreTitle} body={hub.coreBody} href={core.href} cta={hub.coreCta} priceLabel={core.priceLabel} /> : null}
          {dataHub ? (
            <FeatureCard
              icon="data-hub"
              title={hub.dataHubTitle}
              body={hub.dataHubBody}
              href={dataHub.href}
              cta={hub.dataHubCta}
              priceLabel={dataHub.priceLabel}
            />
          ) : null}
        </div>

        <h2 id="landing-hub-title" className="mt-12 m-0 text-lg font-bold tracking-tight text-[#34495E] md:text-xl">
          {hub.satellitesTitle}
        </h2>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[#7F8C8D]">{hub.satellitesIntro}</p>

        <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {industry.map((card) => {
            const Icon = ICONS[card.slug] ?? Store;
            return (
              <li key={card.slug}>
                <Link
                  href={card.href}
                  className={`flex h-full flex-col rounded-2xl border border-[#D5DADF] bg-white p-4 no-underline shadow-sm ${LANDING_CARD_HOVER_CLASS}`}
                >
                  <span className="inline-flex w-fit rounded-lg bg-[#F4F5F7] p-2 text-[#2980B9]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 m-0 text-[15px] font-semibold text-[#34495E]">{card.title}</h3>
                  {card.priceLabel ? (
                    <p className="mt-1 m-0 text-[12px] font-semibold tabular-nums text-[#2980B9]">{card.priceLabel}</p>
                  ) : null}
                  <p className="mt-2 m-0 flex-1 text-[13px] leading-snug text-[#7F8C8D]">{card.body}</p>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#D5DADF] bg-white p-5 shadow-sm md:flex-row md:items-center">
          <div>
            <h3 className="m-0 text-[15px] font-semibold text-[#34495E]">{hub.addonsTitle}</h3>
            <p className="mt-1 m-0 max-w-2xl text-[13px] leading-relaxed text-[#7F8C8D]">{hub.addonsBody}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={addonsHref} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50">
              {hub.addonsCta}
            </Link>
            <Link href="/pricing" className="rounded-xl bg-[#2980B9] px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-[#2471A3]">
              {hub.catalogCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  href,
  cta,
  priceLabel,
}: {
  icon: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  priceLabel?: string;
}) {
  const Icon = ICONS[icon] ?? BookOpen;
  return (
    <Link
      href={href}
      className={`flex h-full flex-col rounded-2xl border border-[#D5DADF] bg-white p-5 no-underline shadow-sm ${LANDING_CARD_HOVER_CLASS}`}
    >
      <span className="inline-flex w-fit rounded-lg bg-[#F4F5F7] p-2 text-[#2980B9]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-3 m-0 text-lg font-bold text-[#34495E]">{title}</h3>
      {priceLabel ? (
        <p className="mt-1 m-0 text-[13px] font-semibold tabular-nums text-[#2980B9]">{priceLabel}</p>
      ) : null}
      <p className="mt-2 m-0 flex-1 text-[14px] leading-relaxed text-[#7F8C8D]">{body}</p>
      <span className="mt-4 text-[13px] font-semibold text-[#2980B9]">{cta}</span>
    </Link>
  );
}
