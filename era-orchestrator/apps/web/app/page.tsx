import { HomePageClient } from "../components/landing/home-page-client";
import { resolvePublicAzRuLocale } from "../lib/public-locale";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await resolvePublicAzRuLocale();
  return <HomePageClient initialLocale={locale} />;
}
