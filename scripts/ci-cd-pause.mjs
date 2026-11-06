/**
 * Temporary CI/CD pause. These apps are still committed by era-git-ship.
 * They do not run in CI (the job stays as a green stub so branch rules pass),
 * are not built into GHCR, and are not pulled on the droplet.
 * The pause wins over the ci-full label and over a packages/docker full rebuild.
 * era-bank-core is not in this list.
 */
export const CI_CD_PAUSED_DIRS = [
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
  "era-wholesale",
  "era-bank",
  "era-bank-dbo",
];

export const CI_CD_PAUSED_SERVICES = [
  "logistics",
  "construction",
  "crm",
  "auto-service",
  "wholesale",
  "bank",
  "bank-dbo",
];

const PAUSED_DIRS = new Set(CI_CD_PAUSED_DIRS);
const PAUSED_SERVICES = new Set(CI_CD_PAUSED_SERVICES);

export function isCiCdPausedDir(dir) {
  return PAUSED_DIRS.has(dir);
}

export function isCiCdPausedService(service) {
  return PAUSED_SERVICES.has(service);
}

export function isCiCdPausedJob(jobKey) {
  return PAUSED_DIRS.has(jobKey);
}
