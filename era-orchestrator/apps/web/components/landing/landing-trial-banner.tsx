import { Check } from "lucide-react";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";

export function LandingTrialBanner({ copy }: { copy: LandingMarketingCopy["trial"] }) {
  return (
    <section className="px-4 py-6 md:py-8" aria-labelledby="landing-trial-offer">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#D5DADF] bg-[#EBF5FB] p-6 md:p-8">
        <span className="absolute right-4 top-4 z-10 rounded-lg bg-[#2980B9] px-3 py-1 text-xs font-semibold text-white">
          {copy.cornerBadge}
        </span>
        <div className="relative z-[1] grid gap-8 md:grid-cols-2 md:gap-10 md:pr-40">
          <div>
            <h2
              id="landing-trial-offer"
              className="m-0 text-3xl font-bold leading-none tracking-tight text-[#34495E] md:text-4xl"
            >
              {copy.offerPrimary}
            </h2>
            <p className="mt-2 text-[14px] font-medium leading-snug tracking-tight text-[#7F8C8D]">
              {copy.offerSubline}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-[#7F8C8D]">
              {copy.checklistTitle}
            </p>
            <ul className="mt-3 list-none space-y-2.5 p-0">
              {copy.checklist.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] leading-snug text-[#34495E]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2980B9]" strokeWidth={2.5} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 pb-1 text-[11px] leading-relaxed text-[#7F8C8D]">{copy.disclaimer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
