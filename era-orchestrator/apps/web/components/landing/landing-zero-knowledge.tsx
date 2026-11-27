import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { LANDING_CARD_HOVER_CLASS } from "../../lib/landing-motion";
import type { LandingZeroKnowledgeCopy } from "../../lib/i18n/landing-marketing-copy";

export function LandingZeroKnowledge({ copy }: { copy: LandingZeroKnowledgeCopy }) {
  const [first, ...rest] = copy.claims;
  return (
    <section className="px-4 py-10 md:py-14" aria-labelledby="landing-zero-knowledge-title">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        <article
          className={`relative overflow-hidden rounded-2xl border border-[#D5DADF] bg-white p-6 shadow-sm md:col-span-2 md:p-8 ${LANDING_CARD_HOVER_CLASS}`}
        >
          <div className="relative">
            <span className="inline-flex rounded-xl border border-[#2980B9]/25 bg-[#EBF5FB] p-2.5 text-[#2980B9]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <h2
              id="landing-zero-knowledge-title"
              className="mt-4 m-0 text-xl font-bold leading-snug tracking-tight text-[#34495E] md:text-2xl"
            >
              {copy.title}
            </h2>
            <ul className="mt-5 flex list-none flex-col gap-3.5 p-0">
              {(first ? [first, ...rest] : rest).map((claim) => (
                <li key={claim.title} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2980B9]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-[#34495E]">{claim.title}</p>
                    <p className="mt-0.5 m-0 text-[13px] leading-snug text-[#7F8C8D]">{claim.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 m-0 text-[12px] text-[#7F8C8D]">{copy.encryptionNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {copy.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-lg border border-[#D5DADF] bg-[#EBEDF0] px-2.5 py-1 text-[11px] font-semibold text-[#34495E]"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </article>
        <div className="grid gap-4">
          <article
            className={`rounded-2xl border border-[#D5DADF] bg-white p-5 ${LANDING_CARD_HOVER_CLASS}`}
          >
            <LockKeyhole className="h-5 w-5 text-[#2980B9]" aria-hidden />
            <p className="mt-3 m-0 text-sm font-semibold text-[#34495E]">{copy.identityEyebrow}</p>
            <p className="mt-1 m-0 text-[13px] text-[#7F8C8D]">{copy.encryptionNote}</p>
          </article>
          <article
            className={`rounded-2xl border border-[#D5DADF] bg-white p-5 ${LANDING_CARD_HOVER_CLASS}`}
          >
            <Fingerprint className="h-5 w-5 text-[#2980B9]" aria-hidden />
            <p className="mt-3 m-0 text-sm font-semibold text-[#34495E]">{copy.badges.join(" · ")}</p>
            <p className="mt-1 m-0 text-[13px] text-[#7F8C8D]">{copy.identityEyebrow}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
