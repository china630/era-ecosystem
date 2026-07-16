"use client";

import { FaqSection } from "@era/satellite-kit/ui";
import type { LandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";

export function LandingFaq({ faq }: { faq: LandingMarketingCopy["faq"] }) {
  return <FaqSection title={faq.title} items={faq.items} id="faq" />;
}
