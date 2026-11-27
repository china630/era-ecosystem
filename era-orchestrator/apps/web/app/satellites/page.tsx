import { redirect } from "next/navigation";
import { resolvePublicAzRuLocale } from "../../lib/public-locale";

export const dynamic = "force-dynamic";

export default async function SatellitesIndexPage() {
  const locale = await resolvePublicAzRuLocale();
  redirect(`/${locale}/satellites`);
}
