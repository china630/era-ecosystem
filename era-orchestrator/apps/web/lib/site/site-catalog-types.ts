export type SiteCatalogMaturity = "prod" | "pilot";

export type CalcPrefillJson = {
  moduleKeys?: string[];
  capacity?: Record<string, number>;
};

export type PublicSiteModule = {
  key: string;
  name: string;
  description: string;
  maturity: SiteCatalogMaturity | null;
};

export type PublicSiteSatellite = {
  satelliteKey: string;
  publicSlug: string;
  kind: string;
  maturity: SiteCatalogMaturity;
  sortOrder: number;
  imageUrl: string | null;
  name: string;
  description: string;
  tagline: string;
  modules: PublicSiteModule[];
};

export type PublicSiteIndustryItem = {
  satelliteKey: string;
  moduleKey: string | null;
  role: string;
  sortOrder: number;
  publicSlug: string | null;
  name: string;
  maturity: SiteCatalogMaturity;
};

export type PublicSiteIndustry = {
  slug: string;
  maturity: SiteCatalogMaturity;
  sortOrder: number;
  imageUrl: string | null;
  name: string;
  description: string;
  calcPrefill: CalcPrefillJson | null;
  items: PublicSiteIndustryItem[];
};

export type SiteCatalogResponse = {
  cacheVersion: number;
  satellites: PublicSiteSatellite[];
  industries: PublicSiteIndustry[];
  unavailable?: true;
};

export function emptySiteCatalog(): SiteCatalogResponse {
  return { cacheVersion: 0, satellites: [], industries: [], unavailable: true };
}

/** Normalize API rows that may omit `modules` on older cache payloads. */
export function withSatelliteModules(
  sat: PublicSiteSatellite,
): PublicSiteSatellite {
  return { ...sat, modules: sat.modules ?? [] };
}