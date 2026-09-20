"use client";

import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";

export function LandingFaq({ faq }: { faq: LandingMarketingCopy["faq"] }) {
  return (
    <section id="faq" className={`${CARD_CONTAINER_CLASS} p-6`}>
      <h2 className="mb-4 text-lg font-semibold text-[#34495E]">{faq.title}</h2>
      <ul className="m-0 list-none space-y-2 p-0">
        {faq.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-[#D5DADF] bg-white">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#34495E] [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span
                  className="shrink-0 text-[#7F8C8D] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </summary>
              <div className="border-t border-[#D5DADF]/80 px-4 py-3">
                <p className="m-0 text-sm leading-relaxed text-[#7F8C8D]">{item.answer}</p>
                {item.chips && item.chips.length > 0 ? (
                  <ul className="mt-3 flex list-none flex-wrap gap-1.5 p-0">
                    {item.chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-2.5 py-0.5 text-[11px] font-medium text-[#2471A3]"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
