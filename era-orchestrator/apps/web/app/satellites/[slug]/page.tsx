import { notFound } from "next/navigation";
import { SatellitePageView } from "../../../components/satellites/satellite-page-view";
import {
  PUBLIC_SATELLITE_SLUGS,
  isPublicSatelliteSlug,
} from "../../../lib/satellites/public-satellite-catalog";
import { resolvePublicAzRuLocale } from "../../../lib/public-locale";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return PUBLIC_SATELLITE_SLUGS.map((slug) => ({ slug }));
}

export default async function PublicSatellitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isPublicSatelliteSlug(slug)) notFound();
  const locale = await resolvePublicAzRuLocale();
  return <SatellitePageView slug={slug} initialLocale={locale} />;
}
