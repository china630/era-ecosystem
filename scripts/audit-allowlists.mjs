/**
 * Shared allowlists for integration audit scripts.
 */

/** Apps allowed to reference data-hub directly */
export const ALLOWED_HUB_APPS = new Set([
  "era-data-hub",
  "era-orchestrator",
  "era-finance-core",
  "era-bank-core",
  "packages",
  "scripts",
  "docs",
  ".github",
]);

/** Industry satellites (exclude control plane + finance/bank cores) */
export const INDUSTRY_APPS = [
  "era-auto-service",
  "era-clinic",
  "era-construction",
  "era-crm",
  "era-fnb-pos",
  "era-hotel-pms",
  "era-logistics",
  "era-retail-pos",
  "era-wholesale",
  "era-bank",
  "era-bank-dbo",
];

/** @param {string} topLevelPathSegment */
export function isIndustryApp(topLevelPathSegment) {
  return topLevelPathSegment.startsWith("era-") && !ALLOWED_HUB_APPS.has(topLevelPathSegment);
}

/** Paths excluded from hub grep (docs, clone specs) */
export function isHubGrepExcluded(rel) {
  return (
    rel.includes("/doc/") ||
    rel.includes("/docs/") ||
    rel.includes("clone-spec") ||
    rel.includes("__fixtures__") ||
    rel.includes("__tests__")
  );
}
