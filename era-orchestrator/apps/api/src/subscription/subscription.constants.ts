/**
 * Ключи для @RequiresModule — см. SubscriptionAccessService.
 * Slugs в activeModules / customConfig.modules: production, manufacturing, fixed_assets, ifrs, banking_pro, hr_full, kassa (и др.).
 */
export const REQUIRES_MODULE_KEY = "subscription:requiresModule" as const;

/**
 * Trial period for new organizations: **Trial-пакет** (`PricingBundle.isTrialDefault`)
 * + `computeTrialExpiresAtUtc` in `trial-package.util.ts` (fallback **90** calendar days).
 */

/**
 * Модули, записываемые в `OrganizationSubscription.activeModules` и `Organization.activeModules`
 * при создании организации (без внешних скриптов).
 * - `nas` — национальный план счетов (ядро книги NAS);
 * - `ifrs` / `ifrs_mapping` — Multi-GAAP / маппинг (согласовано с биллингом и `computeEntitlements`).
 */
export const DEFAULT_NEW_ORGANIZATION_ACTIVE_MODULES: string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
];

export const ModuleEntitlement = {
  MANUFACTURING: "manufacturing",
  FIXED_ASSETS: "fixed_assets",
  /** NAS ↔ IFRS mapping — ENTERPRISE или модуль ifrs */
  IFRS_MAPPING: "ifrs_mapping",
  /** Kassa + banking (single commercial module). */
  CASH_BANK_PRO: "cash_bank_pro",
  /** @deprecated Alias for guards — same entitlement as `cash_bank_pro`. */
  BANKING_PRO: "banking_pro",
  /** @deprecated Alias for guards — same entitlement as `cash_bank_pro`. */
  KASSA_PRO: "kassa_pro",
  /** Расширенный HR (полный пакет) — v8.1 конструктор */
  HR_FULL: "hr_full",
  /** Tax automation features (DVX/e-taxes connector). */
  TAX_PRO: "tax_pro",
  /** Customs / trade portal capture (e-customs widget) + related premium flows. */
  TRADE_PRO: "trade_pro",
  /**
   * Extended tenant recovery (retention / replay) when exposed as a paid add-on — see era-finance-core TZ §21 / CP-BILLING-MIGRATION.md.
   * Today recovery admin APIs are super-admin only; this slug is reserved for constructor billing alignment.
   */
  RECOVERY_PRO: "recovery_pro",
  /** Auditor workplace: timeline, sampling, bulk export, backdating reports (paid add-on). */
  AUDIT_HUB: "audit_hub",
  /** Risk & Compliance (ERM): automated signals and dashboard. */
  COMPLIANCE_PRO: "compliance_pro",
  /** Commercial contract registry and limit gateway. */
  CONTRACT_MANAGEMENT_PRO: "contract_management_pro",
  /** Annual budget plan and execution for B2G organizations. */
  GOV_BUDGET_PRO: "gov_budget_pro",
  /** Industry Solutions verticals (beta; explicit tenant toggle). */
  INDUSTRY_RETAIL: "industry_retail",
  INDUSTRY_LOGISTICS: "industry_logistics",
  INDUSTRY_CONSTRUCTION: "industry_construction",
  INDUSTRY_CRM: "industry_crm",
  INDUSTRY_AUTO_SERVICE: "industry_auto_service",
  INDUSTRY_CLINIC: "industry_clinic",
  INDUSTRY_WHOLESALE: "industry_wholesale",
  INDUSTRY_HOTEL_PMS: "industry_hotel_pms",
  INDUSTRY_FNB_POS: "industry_fnb_pos",
  /** @deprecated Legacy slug — dual-read in SubscriptionAccessService */
  INDUSTRY_RETAIL_ECOM: "industry_retail_ecom",
  /** @deprecated Legacy slug */
  INDUSTRY_LOGISTICS_CUSTOMS: "industry_logistics_customs",
  /** @deprecated Legacy slug */
  INDUSTRY_CRM_WHATSAPP: "industry_crm_whatsapp",
  /** @deprecated Legacy slug */
  INDUSTRY_AUTO_STO: "industry_auto_sto",
  /** @deprecated Legacy slug */
  INDUSTRY_FB_POS: "industry_fb_pos",
  /** Hotel PMS submodules (`pricing_modules`, not platform add-ons). */
  HOTEL_CORE: "hotel_core",
  HOTEL_HOUSEKEEPING: "hotel_housekeeping",
  HOTEL_DISTRIBUTION: "hotel_distribution",
  HOTEL_GUEST_EXPERIENCE: "hotel_guest_experience",
  HOTEL_SPA_SCHEDULING: "hotel_spa_scheduling",
  HOTEL_TRANSFERS: "hotel_transfers",
  HOTEL_BANQUETS: "hotel_banquets",
  HOTEL_MEDICAL_SANATORIUM: "hotel_medical_sanatorium",
  HOTEL_SETUP_ADVANCED: "hotel_setup_advanced",
  /** @deprecated Consolidated into HOTEL_CORE */
  HOTEL_FRONT_OFFICE: "hotel_front_office",
  /** @deprecated Consolidated into HOTEL_CORE */
  HOTEL_NIGHT_AUDIT: "hotel_night_audit",
  /** @deprecated Consolidated into HOTEL_CORE */
  HOTEL_FRONT_CASH: "hotel_front_cash",
  /** @deprecated Consolidated into HOTEL_DISTRIBUTION */
  HOTEL_CHANNEL_OTA: "hotel_channel_ota",
  /** @deprecated Consolidated into HOTEL_DISTRIBUTION */
  HOTEL_CONTRACTS_YIELD: "hotel_contracts_yield",
} as const;

export type ModuleEntitlementKey =
  (typeof ModuleEntitlement)[keyof typeof ModuleEntitlement];
