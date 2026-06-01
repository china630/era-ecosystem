/** Canonical industry billing slugs and one-release legacy aliases. */

export const INDUSTRY_SLUG_ALIASES: Record<string, readonly string[]> = {
  industry_retail: ["industry_retail"],
  industry_logistics: ["industry_logistics"],
  industry_crm: ["industry_crm"],
  industry_auto_service: ["industry_auto_service"],
  industry_fnb_pos: ["industry_fnb_pos"],
};

export function hasIndustrySlug(modules: Set<string>, canonical: string): boolean {
  if (modules.has(canonical)) return true;
  for (const legacy of INDUSTRY_SLUG_ALIASES[canonical] ?? []) {
    if (modules.has(legacy)) return true;
  }
  return false;
}
