export type SiteCatalogMaturity = "prod" | "pilot" | "in_development";

export type SiteArchitectureEdgeKind =
  | "REVENUE_EVENT"
  | "FOLIO_POST"
  | "SETTLEMENT"
  | "LIFECYCLE"
  | "OPS_HANDOFF"
  | "STAFF_PROVISION"
  | "CRM_PARTY"
  | "REFERENCE_DATA"
  | "ANALYTICS"
  | "READ_STATUS"
  | "PLATFORM_IDENTITY"
  | "BANK_CHANNEL";

export type SiteArchitectureRealizationStatus = "live" | "partial" | "planned";

export type PublicSiteArchitectureEdge = {
  fromKey: string;
  toKey: string;
  kind: SiteArchitectureEdgeKind;
  realizationStatus: SiteArchitectureRealizationStatus;
  sortOrder: number;
  label: string;
  labels: { az?: string; ru?: string; en?: string };
};

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

export type SiteCatalogContact = {
  phoneDisplay: string;
  phoneE164: string;
  whatsappUrl: string;
  email: string;
  address: string | null;
  legalName: string | null;
  voen: string | null;
};

export type SiteCatalogResponse = {
  cacheVersion: number;
  satellites: PublicSiteSatellite[];
  industries: PublicSiteIndustry[];
  edges: PublicSiteArchitectureEdge[];
  contact?: SiteCatalogContact;
  unavailable?: true;
};

export function emptySiteCatalog(): SiteCatalogResponse {
  return {
    cacheVersion: 0,
    satellites: [],
    industries: [],
    edges: [],
    contact: {
      phoneDisplay: "+994 77 350 70 70",
      phoneE164: "+994773507070",
      whatsappUrl: "https://wa.me/994773507070",
      email: "chingiz@era-365.online",
      address: null,
      legalName: null,
      voen: null,
    },
    unavailable: true,
  };
}

/** Normalize API rows that may omit `modules` on older cache payloads. */
export function withSatelliteModules(
  sat: PublicSiteSatellite,
): PublicSiteSatellite {
  return { ...sat, modules: sat.modules ?? [] };
}