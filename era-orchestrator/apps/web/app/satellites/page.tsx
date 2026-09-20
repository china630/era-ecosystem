import { SatellitesIndexView } from "../../components/satellites/satellite-page-view";
import { resolvePublicAzRuLocale } from "../../lib/public-locale";

export const dynamic = "force-dynamic";

export default async function SatellitesIndexPage() {
  const locale = await resolvePublicAzRuLocale();
  return <SatellitesIndexView initialLocale={locale} />;
}
