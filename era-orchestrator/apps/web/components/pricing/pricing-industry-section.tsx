"use client";

import Link from "next/link";
import {
  BedDouble,
  Building2,
  Landmark,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { PRICING_CARD_HOVER_CLASS } from "../../lib/landing-motion";

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  industry_hotel_pms: BedDouble,
  industry_clinic: Stethoscope,
  industry_fnb_pos: UtensilsCrossed,
  industry_retail: Store,
  industry_auto_service: Wrench,
  industry_logistics: Truck,
  industry_construction: Building2,
  industry_wholesale: Warehouse,
  industry_crm: MessageCircle,
  industry_banking: Landmark,
};

export function PricingIndustrySection({
  title,
  intro,
  bundleSelectLabel,
  perMonthSuffix,
  groups,
  selectedBySatellite,
  onSelectBundle,
}: {
  title: string;
  intro: string;
  bundleSelectLabel: string;
  perMonthSuffix: string;
  groups: PricingStorefrontView["industryGroups"];
  selectedBySatellite: Record<string, string | null>;
  onSelectBundle: (satelliteKey: string, marketingId: string | null) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <section id="industries" className="px-4 pb-10" aria-labelledby="pricing-industries-title">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-industries-title" className="m-0 text-lg font-bold text-slate-800 md:text-xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600">{intro}</p>

        <div className="mt-8 space-y-10">
          {groups.map((g) => {
            const Icon = GROUP_ICONS[g.satelliteKey] ?? Store;
            const selectedId = selectedBySatellite[g.satelliteKey] ?? null;
            return (
              <article key={g.satelliteKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-slate-600" aria-hidden />
                  <h3 className="m-0 text-[16px] font-bold text-slate-800">{g.title}</h3>
                </div>
                {g.intro ? (
                  <p className="mt-2 m-0 text-[13px] leading-relaxed text-slate-600">{g.intro}</p>
                ) : null}
                {g.note ? (
                  <p className="mt-2 m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    {g.note}
                  </p>
                ) : null}

                {g.gate ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-800">{g.gateLabel}</span>
                    <span className="ml-3 tabular-nums text-slate-600">
                      {fmtAzn(g.gate.pricePerMonth)}
                      {perMonthSuffix}
                    </span>
                    {g.capacityLine ? (
                      <p className="mt-1 m-0 text-[12px] text-slate-500">{g.capacityLine}</p>
                    ) : null}
                  </div>
                ) : null}

                {g.bundles.length > 0 ? (
                  <>
                    <p className="mt-5 text-[13px] font-semibold text-slate-700">{bundleSelectLabel}</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      {g.bundles.map((b) => {
                        const selected = selectedId === b.marketingId;
                        return (
                          <button
                            key={b.marketingId}
                            type="button"
                            onClick={() =>
                              onSelectBundle(g.satelliteKey, selected ? null : b.marketingId)
                            }
                            className={`${PRICING_CARD_HOVER_CLASS} rounded-2xl border bg-white p-4 text-left shadow-sm ${
                              selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                            }`}
                          >
                            <h4 className="m-0 font-semibold text-slate-800">{b.name}</h4>
                            <p className="mt-1 text-[12px] text-slate-600">{b.moduleLine}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-800">
                              {fmtAzn(b.discountedPriceAzn)}
                              {perMonthSuffix}
                              <span className="ml-2 text-[12px] font-normal text-slate-500">
                                ({b.discountBadge})
                              </span>
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {g.modules.length > 0 ? (
                  <ul className="mt-5 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {g.modules.map((m) => (
                      <li
                        key={m.key}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      >
                        <span className="pr-2 font-medium text-slate-800">{m.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {fmtAzn(m.pricePerMonth)}
                          {perMonthSuffix}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-slate-500">
          <Link href="/register-org" className="font-medium text-sky-700 hover:underline">
            Register
          </Link>
          {" · "}
          à la carte modules available in Billing → Modules after sign-up.
        </p>
      </div>
    </section>
  );
}
