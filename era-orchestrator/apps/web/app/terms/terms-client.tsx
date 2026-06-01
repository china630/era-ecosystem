"use client";

import { SatelliteLocaleToggle } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

type Props = {
  locale: Locale;
  content: {
    title: string;
    intro: string;
    section1Title: string;
    section1Body: string;
    section2Title: string;
    section2Body: string;
    section3Title: string;
    section3Body: string;
  };
};

export function TermsPageClient({ locale, content }: Props) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#34495E]">{content.title}</h1>
        <SatelliteLocaleToggle locale={locale} />
      </div>
      <article className="space-y-4 text-[13px] leading-relaxed text-[#34495E]">
        <p>{content.intro}</p>
        <section>
          <h2 className="text-lg font-semibold">{content.section1Title}</h2>
          <p className="mt-2 text-[#7F8C8D]">{content.section1Body}</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">{content.section2Title}</h2>
          <p className="mt-2 text-[#7F8C8D]">{content.section2Body}</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">{content.section3Title}</h2>
          <p className="mt-2 text-[#7F8C8D]">{content.section3Body}</p>
        </section>
      </article>
    </main>
  );
}
