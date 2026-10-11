import { cookies } from "next/headers";
import { ERA_I18N_COOKIE, isLocale, type Locale } from "@era/i18n-common";
import { CalcPageView } from "../../components/calc/calc-page-view";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";

export const dynamic = "force-dynamic";

export default async function PublicCalcPage() {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ERA_I18N_COOKIE)?.value;
  const locale: Locale = fromCookie && isLocale(fromCookie) ? fromCookie : "az";
  const snapshot = await fetchPublicPricingSnapshot();
  return <CalcPageView initialLocale={locale} snapshot={snapshot} />;
}
