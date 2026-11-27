import { redirect } from "next/navigation";
import {
  PUBLIC_SATELLITE_SLUGS,
  isPublicSatelliteSlug,
} from "../../../lib/satellites/public-satellite-catalog";
import { resolvePublicAzRuLocale } from "../../../lib/public-locale";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return PUBLIC_SATELLITE_SLUGS.map((slug) => ({ slug }));
}

/** Unprefixed marketing URLs redirect into locale shell (SiteHeader). */
export default async function PublicSatellitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await resolvePublicAzRuLocale();
  if (!isPublicSatelliteSlug(slug)) {
    redirect(`/${locale}/satellites`);
  }
  redirect(`/${locale}/satellites/${slug}`);
}
