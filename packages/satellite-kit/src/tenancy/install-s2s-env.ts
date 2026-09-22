/**
 * Docker/compose injects secrets before Node boot. Sync hydrate must not lose them
 * when `_era_runtime_config` still holds a `change-me-…` placeholder.
 */
import { isFolkloreS2sToken } from "./folklore-s2s-token";

const INSTALL_TOKEN_ENV_KEYS = [
  "SATELLITE_EVENT_SERVICE_TOKEN",
  "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
  "CONTROL_PLANE_SERVICE_TOKEN",
] as const;

let installSatelliteEventToken = snapshotEnvToken();

function snapshotEnvToken(): string {
  for (const key of INSTALL_TOKEN_ENV_KEYS) {
    const v = process.env[key]?.trim();
    if (v && !isFolkloreS2sToken(v)) return v;
  }
  for (const key of INSTALL_TOKEN_ENV_KEYS) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  return "";
}

export function getInstallSatelliteEventToken(): string {
  return installSatelliteEventToken;
}

/** Tests: re-read process.env after mutating SATELLITE_EVENT_SERVICE_TOKEN. */
export function recaptureInstallSatelliteEventToken(): void {
  installSatelliteEventToken = snapshotEnvToken();
}
