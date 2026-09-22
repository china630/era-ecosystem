import { getRuntimeConfigMemory } from "./runtime-config-memory";
import { preferInClusterOrchestratorUrl } from "./compose-hostname";
import { isFolkloreS2sToken } from "./folklore-s2s-token";
import { getInstallSatelliteEventToken } from "./install-s2s-env";

export {
  isRunningInsideDocker,
  rewriteComposeHostnameForHost,
  preferInClusterOrchestratorUrl,
  isPublicOrchestratorUrl,
} from "./compose-hostname";
export { isFolkloreS2sToken } from "./folklore-s2s-token";

/**
 * Orchestrator / control-plane base URL.
 * Prefer runtime-config (Sync desired state); env is bootstrap / emergency override only.
 */
export function resolveOrchestratorBaseUrl(opts?: {
  /** Default when neither memory nor env is set (local smoke). */
  fallback?: string;
}): string {
  const fromMem = getRuntimeConfigMemory().orchestratorEventUrl?.trim();
  if (fromMem) {
    return preferInClusterOrchestratorUrl(fromMem);
  }

  const fromEnv = (
    process.env.ORCHESTRATOR_EVENT_URL?.trim() ||
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    ""
  );
  if (fromEnv) {
    return preferInClusterOrchestratorUrl(fromEnv);
  }

  const fallback = (opts?.fallback ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  return preferInClusterOrchestratorUrl(fallback);
}

function firstNonFolkloreToken(candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (t && !isFolkloreS2sToken(t)) return t;
  }
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (t) return t;
  }
  return "";
}

/** Event / internal service token: non-folklore install env beats a stale Sync placeholder. */
export function resolveSatelliteEventServiceToken(): string {
  return firstNonFolkloreToken([
    getRuntimeConfigMemory().satelliteEventServiceToken,
    getInstallSatelliteEventToken(),
    process.env.SATELLITE_EVENT_SERVICE_TOKEN,
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN,
    process.env.CONTROL_PLANE_SERVICE_TOKEN,
  ]);
}

/**
 * Bearer for CP internal snapshot / platform S2S.
 * Prefer a non-folklore secret so `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN=dev-control-plane-token`
 * (clinic compose default) cannot hide `SATELLITE_EVENT_SERVICE_TOKEN` from droplet `.env`.
 */
export function resolveControlPlaneBearerToken(explicit?: string): string {
  return firstNonFolkloreToken([
    explicit,
    process.env.CONTROL_PLANE_SERVICE_TOKEN,
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN,
    resolveSatelliteEventServiceToken(),
  ]);
}
