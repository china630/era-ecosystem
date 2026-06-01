import { cookies } from "next/headers";
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
