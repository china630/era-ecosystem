import type { PricingMetersCopy } from "../../lib/i18n/pricing-meters-copy";

export function PricingMetersCatalog({ copy }: { copy: PricingMetersCopy }) {
  return (
    <section id="meters" className="scroll-mt-24 px-4 py-6" aria-labelledby="pricing-meters-title">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-meters-title" className="m-0 text-lg font-bold tracking-tight text-slate-800 md:text-xl">
          {copy.metersTitle}
        </h2>
        <p className="mt-2 m-0 max-w-3xl text-[13px] leading-relaxed text-slate-600">{copy.metersHint}</p>
        <p className="mt-1 m-0 max-w-3xl text-[12px] text-slate-500">{copy.metersCanonNote}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[40rem] w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold"> </th>
                <th className="px-3 py-2 font-semibold">{copy.includedCol}</th>
                <th className="px-3 py-2 font-semibold">{copy.overageCol}</th>
              </tr>
            </thead>
            <tbody>
              {copy.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <th scope="row" className="px-3 py-2.5 font-semibold text-slate-800">
                    {row.label}
                  </th>
                  <td className="px-3 py-2.5 text-slate-600">{row.included}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-700">{row.overage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function PricingToc({
  copy,
  showSkuSections,
}: {
  copy: PricingMetersCopy;
  showSkuSections: boolean;
}) {
  const links = [
    ...(showSkuSections
      ? [
          { href: "#core", label: copy.tocCore },
          { href: "#bundles", label: copy.tocBundles },
          { href: "#hotel", label: copy.tocIndustries },
          { href: "#addons", label: copy.tocAddons },
          { href: "#premium", label: copy.tocPremium },
        ]
      : []),
    { href: "#meters", label: copy.tocMeters },
    ...(showSkuSections ? [{ href: "#spend-tiers", label: copy.tocSpend }] : []),
  ];
  return (
    <nav aria-label={copy.tocTitle} className="mx-auto max-w-6xl px-4 pb-4">
      <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">{copy.tocTitle}</p>
      <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 no-underline hover:border-[#2980B9]/40 hover:text-[#2471A3]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
