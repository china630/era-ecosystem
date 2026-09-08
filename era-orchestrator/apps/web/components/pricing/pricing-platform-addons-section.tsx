import type { PricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

export function PricingPlatformAddonsSection({
  title,
  hint,
  xorHint,
  perMonthSuffix,
  addons,
}: {
  title: string;
  hint: string;
  xorHint: string;
  perMonthSuffix: string;
  addons: PricingStorefrontView["platformAddons"];
}) {
  if (addons.length === 0) return null;

  return (
    <section id="platform-addons" className="px-4 pb-10" aria-labelledby="pricing-addons-title">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-addons-title" className="m-0 text-lg font-bold text-slate-800 md:text-xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600">{hint}</p>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-500">{xorHint}</p>
        <ul className="mt-5 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {addons.map((m) => (
            <li
              key={m.key}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <span className="pr-2 font-medium text-slate-800">{m.name}</span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {fmtAzn(m.pricePerMonth)}
                {perMonthSuffix}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
