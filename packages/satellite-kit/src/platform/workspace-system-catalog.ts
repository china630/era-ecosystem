import type { IndustryModuleKey } from "./industry-modules";

/** i18n key prefix in orchestrator: workspace.systems.{key} */
export type WorkspaceSystemKey = IndustryModuleKey | "FINANCE";

export type WorkspaceSystemMeta = {
  key: WorkspaceSystemKey;
  /** Pricing catalog slug for /v1/public/pricing lookup */
  pricingModuleKey: string;
  sanatoriumRelevant: boolean;
  /** i18n key suffix under workspace.systems.{key} */
  i18nKey: string;
};

export const WORKSPACE_SYSTEMS: WorkspaceSystemMeta[] = [
  {
    key: "FINANCE",
    pricingModuleKey: "foundation",
    sanatoriumRelevant: true,
    i18nKey: "finance",
  },
  {
    key: "HOTEL_PMS",
    pricingModuleKey: "industry_hotel_pms",
    sanatoriumRelevant: true,
    i18nKey: "hotel",
  },
  {
    key: "CLINIC",
    pricingModuleKey: "industry_clinic",
    sanatoriumRelevant: true,
    i18nKey: "clinic",
  },
  {
    key: "FNB_POS",
    pricingModuleKey: "industry_fnb_pos",
    sanatoriumRelevant: true,
    i18nKey: "fnb",
  },
  {
    key: "RETAIL",
    pricingModuleKey: "industry_retail",
    sanatoriumRelevant: true,
    i18nKey: "retail",
  },
  {
    key: "LOGISTICS",
    pricingModuleKey: "industry_logistics",
    sanatoriumRelevant: false,
    i18nKey: "logistics",
  },
  {
    key: "CONSTRUCTION",
    pricingModuleKey: "industry_construction",
    sanatoriumRelevant: false,
    i18nKey: "construction",
  },
  {
    key: "CRM",
    pricingModuleKey: "industry_crm",
    sanatoriumRelevant: false,
    i18nKey: "crm",
  },
  {
    key: "AUTO_SERVICE",
    pricingModuleKey: "industry_auto_service",
    sanatoriumRelevant: false,
    i18nKey: "auto",
  },
  {
    key: "WHOLESALE",
    pricingModuleKey: "industry_wholesale",
    sanatoriumRelevant: false,
    i18nKey: "wholesale",
  },
];

export const SANATORIUM_SYSTEM_KEYS: WorkspaceSystemKey[] = WORKSPACE_SYSTEMS.filter(
  (s) => s.sanatoriumRelevant,
).map((s) => s.key);

/** Orchestrator satellite entitlement key for workspace Connect API. */
export const WORKSPACE_SATELLITE_KEY: Record<WorkspaceSystemKey, string> = {
  FINANCE: "finance_core",
  HOTEL_PMS: "industry_hotel_pms",
  FNB_POS: "industry_fnb_pos",
  RETAIL: "industry_retail",
  LOGISTICS: "industry_logistics",
  CONSTRUCTION: "industry_construction",
  CRM: "industry_crm",
  AUTO_SERVICE: "industry_auto_service",
  CLINIC: "industry_clinic",
  WHOLESALE: "industry_wholesale",
};
