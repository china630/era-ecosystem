#!/usr/bin/env node
/** Copy Finance pricing storefront to Orchestrator web and adapt imports. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const finWeb = path.join(root, "era-finance-core/apps/web");
const orchWeb = path.join(root, "era-orchestrator/apps/web");

const copies = [
  ["components/pricing", "components/pricing"],
  ["lib/pricing", "lib/pricing"],
  ["lib/public-pricing-types.ts", "lib/public-pricing-types.ts"],
];

function cpDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) cpDir(s, d);
    else {
      let text = fs.readFileSync(s, "utf8");
      text = text
        .replace(/from "\.\.\/landing\/landing-language-toggle"/g, 'from "../locale/landing-language-toggle"')
        .replace(/from "\.\.\/public-legal-footer"/g, 'from "@era/satellite-kit/ui"')
        .replace(/PublicLegalFooter from "@era\/satellite-kit\/ui"/g, '{ PublicLegalFooter } from "@era/satellite-kit/ui"')
        .replace(/from "\.\.\/\.\.\/lib\/i18n\/pricing-storefront-copy"/g, 'from "../../lib/i18n/pricing-storefront-copy"')
        .replace(/href="\/register-org"/g, 'href="/register-org"')
        .replace(/href="\/login"/g, 'href="/login"');
      if (name === "pricing-page-view.tsx") {
        text = text.replace(
          /import \{ PublicLegalFooter \} from "@era\/satellite-kit\/ui";/,
          'import { PublicLegalFooter } from "@era/satellite-kit/ui";\nimport { useLocale } from "next-intl";',
        );
        text = text.replace(
          /<PublicLegalFooter labels=\{\{[\s\S]*?\}\} \/>/,
          `<PublicLegalFooter locale={useLocale() as "az" | "ru" | "en"} faqHref="/help" labels={{
            navAria: locale === "ru" ? "Юридические ссылки" : "Hüquqi keçidlər",
            faq: "FAQ",
            terms: locale === "ru" ? "Условия" : "Şərtlər",
            privacy: locale === "ru" ? "Конфиденциальность" : "Məxfilik",
            status: "Status",
          }} />`,
        );
      }
      fs.writeFileSync(d, text, "utf8");
    }
  }
}

for (const [from, to] of copies) {
  const src = path.join(finWeb, from);
  const dest = path.join(orchWeb, to);
  if (fs.statSync(src).isDirectory()) cpDir(src, dest);
  else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  console.log("copied", from, "->", to);
}

// fetch-public-pricing for orchestrator API
const fetchPricing = `import type { PublicPricingResponse } from "../public-pricing-types";

const ORCH_API = process.env.NEXT_PUBLIC_ORCH_API_URL ?? "http://127.0.0.1:4000";

export async function fetchPublicPricingSnapshot(): Promise<PublicPricingResponse> {
  try {
    const res = await fetch(\`\${ORCH_API.replace(/\\/$/, "")}/v1/public/pricing\`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return unavailablePricingSnapshot();
    return (await res.json()) as PublicPricingResponse;
  } catch {
    return unavailablePricingSnapshot();
  }
}

function unavailablePricingSnapshot(): PublicPricingResponse {
  return {
    currency: "AZN",
    foundationMonthlyAzn: 0,
    yearlyDiscountPercent: 0,
    pricingModules: [],
    pricingBundles: [],
    meterUnitPricing: {
      pricePerUserMonthAzn: 0,
      pricePerGbMonthAzn: 0,
      pricePerWhatsappAlertAzn: 0,
      pricePerInvoiceAzn: 0,
      pricePerOcrPageAzn: 0,
    },
    tierSpendCeilings: {},
    ocrJobsPerOrgMonth: null,
    unavailable: true,
  };
}
`;
fs.writeFileSync(path.join(orchWeb, "lib/pricing/fetch-public-pricing.ts"), fetchPricing);

// pricing storefront copy re-export from finance package if exists
const pricingCopy = `export { getPricingStorefrontUiCopy } from "@erafinance/i18n/pricing-storefront-copy";
`;
const i18nDir = path.join(orchWeb, "lib/i18n");
fs.mkdirSync(i18nDir, { recursive: true });
fs.writeFileSync(path.join(i18nDir, "pricing-storefront-copy.ts"), pricingCopy);

// landing language toggle for orchestrator
const toggle = `"use client";

import type { Locale } from "@era/i18n-common";
import { LocaleToggle } from "@era/satellite-kit/ui";

export function LandingLanguageToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  return <LocaleToggle locale={locale} onChange={onChange} labels={{ az: "AZ", ru: "RU", en: "EN" }} />;
}
`;
fs.mkdirSync(path.join(orchWeb, "components/locale"), { recursive: true });
fs.writeFileSync(path.join(orchWeb, "components/locale/landing-language-toggle.tsx"), toggle);

// pricing page
const pricingPage = `import { cookies } from "next/headers";
import { ERA_I18N_COOKIE, isLocale } from "@era/i18n-common";
import { PricingPageView } from "../../components/pricing/pricing-page-view";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";

async function resolvePricingLocale(): Promise<"az" | "ru"> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ERA_I18N_COOKIE)?.value;
  if (fromCookie && isLocale(fromCookie) && fromCookie !== "en") return fromCookie;
  return "az";
}

export default async function PublicPricingPage() {
  const locale = await resolvePricingLocale();
  const snapshot = await fetchPublicPricingSnapshot();
  return <PricingPageView initialLocale={locale} snapshot={snapshot} />;
}
`;
fs.mkdirSync(path.join(orchWeb, "app/pricing"), { recursive: true });
fs.writeFileSync(path.join(orchWeb, "app/pricing/page.tsx"), pricingPage);

console.log("orchestrator pricing scaffold done");
