import { cookies } from "next/headers";
import { ERA_I18N_COOKIE, isLocale, type Locale } from "@era/i18n-common";
import { CalcPageView } from "../../components/calc/calc-page-view";
import { LandingPageShell } from "../../components/landing/landing-page-shell";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { getSiteNavCopy } from "../../lib/i18n/site-nav-copy";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import { fetchSiteCatalog } from "../../lib/site/fetch-site-catalog";

export const dynamic = "force-dynamic";

export default async function PublicCalcPage() {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ERA_I18N_COOKIE)?.value;
  const locale: Locale = fromCookie && isLocale(fromCookie) ? fromCookie : "az";
  const [snapshot, catalog] = await Promise.all([
    fetchPublicPricingSnapshot(),
    fetchSiteCatalog(locale),
  ]);
  const labels = getSiteNavCopy(locale);

  return (
    <LandingPageShell>
      <SiteHeader locale={locale} catalog={catalog} labels={labels} />
      <CalcPageView initialLocale={locale} snapshot={snapshot} hideChrome />
      <SiteFooter locale={locale} catalog={catalog} labels={labels} />
    </LandingPageShell>
  );
}
