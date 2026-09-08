/** Public marketing satellite pages — not the authenticated `/industry/[vertical]` launcher. */

export const PUBLIC_SATELLITE_SLUGS = [
  "finance",
  "hotel",
  "clinic",
  "fnb",
  "retail",
  "auto",
  "logistics",
  "construction",
  "wholesale",
  "crm",
  "banking",
  "data-hub",
] as const;

export type PublicSatelliteSlug = (typeof PUBLIC_SATELLITE_SLUGS)[number];

export type PublicSatelliteKind = "core" | "industry" | "platform";

export type PublicSatelliteDef = {
  slug: PublicSatelliteSlug;
  kind: PublicSatelliteKind;
  satelliteKey: string | null;
  pricingAnchor: string;
  pricingKey: string | null;
  dataHubKeys?: readonly string[];
};

export const PUBLIC_SATELLITE_PAGES: readonly PublicSatelliteDef[] = [
  {
    slug: "finance",
    kind: "core",
    satelliteKey: null,
    pricingAnchor: "core",
    pricingKey: "foundation",
  },
  {
    slug: "hotel",
    kind: "industry",
    satelliteKey: "industry_hotel_pms",
    pricingAnchor: "hotel",
    pricingKey: "industry_hotel_pms",
  },
  {
    slug: "clinic",
    kind: "industry",
    satelliteKey: "industry_clinic",
    pricingAnchor: "clinic",
    pricingKey: "industry_clinic",
  },
  {
    slug: "fnb",
    kind: "industry",
    satelliteKey: "industry_fnb_pos",
    pricingAnchor: "fnb",
    pricingKey: "industry_fnb_pos",
  },
  {
    slug: "retail",
    kind: "industry",
    satelliteKey: "industry_retail",
    pricingAnchor: "retail",
    pricingKey: "industry_retail",
  },
  {
    slug: "auto",
    kind: "industry",
    satelliteKey: "industry_auto_service",
    pricingAnchor: "auto",
    pricingKey: "industry_auto_service",
  },
  {
    slug: "logistics",
    kind: "industry",
    satelliteKey: "industry_logistics",
    pricingAnchor: "logistics",
    pricingKey: "industry_logistics",
  },
  {
    slug: "construction",
    kind: "industry",
    satelliteKey: "industry_construction",
    pricingAnchor: "construction",
    pricingKey: "industry_construction",
  },
  {
    slug: "wholesale",
    kind: "industry",
    satelliteKey: "industry_wholesale",
    pricingAnchor: "wholesale",
    pricingKey: "industry_wholesale",
  },
  {
    slug: "crm",
    kind: "industry",
    satelliteKey: "industry_crm",
    pricingAnchor: "crm",
    pricingKey: "industry_crm",
  },
  {
    slug: "banking",
    kind: "industry",
    satelliteKey: "industry_banking",
    pricingAnchor: "banking",
    pricingKey: "industry_banking",
  },
  {
    slug: "data-hub",
    kind: "platform",
    satelliteKey: null,
    pricingAnchor: "addons",
    pricingKey: "platform_reference_data",
    dataHubKeys: [
      "platform_reference_data",
      "platform_datahub_silver",
      "platform_datahub_gold",
    ],
  },
] as const;

export const SATELLITE_KEY_TO_PRICING_ANCHOR: Record<string, string> = {
  industry_hotel_pms: "hotel",
  industry_clinic: "clinic",
  industry_fnb_pos: "fnb",
  industry_retail: "retail",
  industry_auto_service: "auto",
  industry_logistics: "logistics",
  industry_construction: "construction",
  industry_wholesale: "wholesale",
  industry_crm: "crm",
  industry_banking: "banking",
};

export function isPublicSatelliteSlug(value: string): value is PublicSatelliteSlug {
  return (PUBLIC_SATELLITE_SLUGS as readonly string[]).includes(value);
}

export function publicSatelliteBySlug(slug: string): PublicSatelliteDef | null {
  if (!isPublicSatelliteSlug(slug)) return null;
  return PUBLIC_SATELLITE_PAGES.find((p) => p.slug === slug) ?? null;
}

export function pricingHrefForSatellite(slug: PublicSatelliteSlug): string {
  const page = publicSatelliteBySlug(slug);
  return page ? `/pricing#${page.pricingAnchor}` : "/pricing";
}
