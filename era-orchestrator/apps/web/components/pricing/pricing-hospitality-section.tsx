"use client";

import Link from "next/link";
import { BedDouble } from "lucide-react";
import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { PRICING_CARD_HOVER_CLASS } from "../../lib/landing-motion";

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

export function PricingHospitalitySection({
  title,
  intro,
  gateLabel,
  bundleSelectLabel,
  perMonthSuffix,
  bundles,
  modules,
  selectedHospitalityBundleId,
  onSelectHospitalityBundle,
}: {
  title: string;
  intro: string;
  gateLabel: string;
  bundleSelectLabel: string;
  perMonthSuffix: string;
  bundles: PricingStorefrontView["hospitalityBundles"];
  modules: PricingStorefrontView["hospitalityModules"];
  selectedHospitalityBundleId: string | null;
  onSelectHospitalityBundle: (id: string | null) => void;
}) {
  if (bundles.length === 0 && modules.length === 0) return null;

  const gate = modules.find((m) => m.key === "industry_hotel_pms");
  const submodules = modules.filter((m) => m.key !== "industry_hotel_pms");

  return (
    <section id="hospitality" className="px-4 pb-10" aria-labelledby="pricing-hospitality-title">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-slate-600" aria-hidden />
          <h2 id="pricing-hospitality-title" className="m-0 text-lg font-bold text-slate-800 md:text-xl">
            {title}
          </h2>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-slate-600">{intro}</p>

        {gate ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="font-semibold text-slate-800">{gateLabel}</span>
            <span className="ml-3 text-slate-600">
              {fmtAzn(gate.pricePerMonth)}
              {perMonthSuffix}
            </span>
          </div>
        ) : null}

        {bundles.length > 0 ? (
          <>
            <p className="mt-6 text-[13px] font-semibold text-slate-700">{bundleSelectLabel}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {bundles.map((b) => {
                const selected = selectedHospitalityBundleId === b.marketingId;
                return (
                  <button
                    key={b.marketingId}
                    type="button"
                    onClick={() =>
                      onSelectHospitalityBundle(selected ? null : b.marketingId)
                    }
                    className={`${PRICING_CARD_HOVER_CLASS} rounded-2xl border bg-white p-4 text-left shadow-sm ${
                      selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                    }`}
                  >
                    <h3 className="font-semibold text-slate-800">{b.name}</h3>
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

        {submodules.length > 0 ? (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {submodules.map((m) => (
              <li
                key={m.key}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">{m.name}</span>
                <span className="text-slate-600">
                  {fmtAzn(m.pricePerMonth)}
                  {perMonthSuffix}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

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
