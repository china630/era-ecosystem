import { PricingPageView } from "../../components/pricing/pricing-page-view";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import { resolvePublicAzRuLocale } from "../../lib/public-locale";

export const dynamic = "force-dynamic";

export default async function PublicPricingPage() {
  const locale = await resolvePublicAzRuLocale();
  const snapshot = await fetchPublicPricingSnapshot();
  return <PricingPageView initialLocale={locale} snapshot={snapshot} />;
}
