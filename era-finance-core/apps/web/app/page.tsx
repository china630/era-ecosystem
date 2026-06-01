import { cookies } from "next/headers";
import { ERA_I18N_COOKIE, resolveLocale } from "@era/i18n-common";
import { LandingPageView } from "../components/landing/landing-page-view";

async function resolveLandingLocale() {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(ERA_I18N_COOKIE)?.value, {
    erafinance_i18n_lang: cookieStore.get("erafinance_i18n_lang")?.value,
  });
}

/** Public marketing landing: hero + FAQ (copy from `@erafinance/i18n/landing-copy`). */
export default async function LandingPage() {
  const locale = await resolveLandingLocale();
  return <LandingPageView initialLocale={locale} />;
}
