import {
  fetchSubscriptionSnapshot,
  hasActiveModule,
} from "./platform-hook-policy";

export const INDUSTRY_MODULE_BY_APP = {
  hotel: "industry_hotel_pms",
  fb: "industry_fb_pos",
  retail: "industry_retail_ecom",
  logistics: "industry_logistics_customs",
  construction: "industry_construction",
  crm: "industry_crm_whatsapp",
  auto: "industry_auto_sto",
  clinic: "industry_clinic",
  wholesale: "industry_wholesale",
} as const;

export type IndustryAppKey = keyof typeof INDUSTRY_MODULE_BY_APP;

export class IndustryModuleInactiveError extends Error {
  readonly status = 403;
  readonly moduleKey: string;

  constructor(moduleKey: string) {
    super(`Industry module not active: ${moduleKey}`);
    this.name = "IndustryModuleInactiveError";
    this.moduleKey = moduleKey;
  }
}

export async function assertIndustryModuleActive(
  organizationId: string,
  app: IndustryAppKey,
): Promise<void> {
  const moduleKey = INDUSTRY_MODULE_BY_APP[app];
  const snapshot = await fetchSubscriptionSnapshot(organizationId);
  if (!snapshot || !hasActiveModule(snapshot, moduleKey)) {
    throw new IndustryModuleInactiveError(moduleKey);
  }
}

export async function isIndustryModuleActive(
  organizationId: string,
  app: IndustryAppKey,
): Promise<boolean> {
  try {
    await assertIndustryModuleActive(organizationId, app);
    return true;
  } catch {
    return false;
  }
}
