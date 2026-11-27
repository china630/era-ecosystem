import type { MetadataRoute } from "next";
import { fetchSiteCatalog } from "../lib/site/fetch-site-catalog";
import { buildAlternateLanguages } from "../lib/site/site-metadata";
import { siteOrigin } from "../lib/site/site-origins";

const LOCALES = ["az", "ru", "en"] as const;
const STATIC = [
  "",
  "/satellites",
  "/industries",
  "/pricing",
  "/calculator",
  "/demo",
  "/contact",
  "/help",
  "/terms",
] as const;

function catalogPath(path: string): string {
  return path === "" ? "/" : path;
}

function pushLocalizedEntry(
  entries: MetadataRoute.Sitemap,
  locale: (typeof LOCALES)[number],
  path: string,
) {
  const marketingPath = catalogPath(path);
  entries.push({
    url: buildAlternateLanguages(marketingPath)[locale],
    alternates: {
      languages: buildAlternateLanguages(marketingPath),
    },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await fetchSiteCatalog("az");
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const path of STATIC) {
      pushLocalizedEntry(entries, locale, path);
    }
    for (const s of catalog.satellites) {
      pushLocalizedEntry(entries, locale, `/satellites/${s.publicSlug}`);
    }
    for (const ind of catalog.industries) {
      pushLocalizedEntry(entries, locale, `/industries/${ind.slug}`);
    }
  }

  // `/calc` stays unprefixed (owns ?q= history).
  entries.push({
    url: `${siteOrigin()}/calc`,
  });

  return entries;
}
