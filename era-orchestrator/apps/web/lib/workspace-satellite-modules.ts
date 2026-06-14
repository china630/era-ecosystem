import type { PublicPricingModule } from "./public-pricing-types";

/** Modules belonging to a satellite gate (pricing_modules.satelliteKey or gate slug). */
export function catalogModulesForSatellite(
  modules: PublicPricingModule[],
  satelliteKey: string,
): PublicPricingModule[] {
  return modules
    .filter(
      (m) => m.satelliteKey === satelliteKey || m.key === satelliteKey,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isModuleActive(activeModules: string[] | undefined, moduleKey: string): boolean {
  if (!activeModules) return false;
  if (activeModules.includes(moduleKey)) return true;
  if (moduleKey === "manufacturing" && activeModules.includes("production")) return true;
  return false;
}
