import { getRuntimeConfigMemory } from "./runtime-config-memory";
import { rewriteComposeHostnameForHost } from "./compose-hostname";

export { isRunningInsideDocker, rewriteComposeHostnameForHost } from "./compose-hostname";

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
    return rewriteComposeHostnameForHost(fromMem);
  }

  const fromEnv = (
    process.env.ORCHESTRATOR_EVENT_URL?.trim() ||
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    ""
  );
  if (fromEnv) {
    return rewriteComposeHostnameForHost(fromEnv);
  }

  const fallback = (opts?.fallback ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  return rewriteComposeHostnameForHost(fallback);
}

/** Compose folklore defaults — must not shadow a real droplet SATELLITE_EVENT token. */
const FOLKLORE_S2S_TOKENS = new Set([
  "dev-control-plane-token",
  "dev-satellite-event-token",
]);

/** Event / internal service token: memory first, then env bootstrap. */
export function resolveSatelliteEventServiceToken(): string {
  const fromMem = getRuntimeConfigMemory().satelliteEventServiceToken?.trim();
  if (fromMem) return fromMem;
  return (
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    ""
  );
}

/**
 * Bearer for CP internal snapshot / platform S2S.
 * Prefer a non-folklore secret so `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN=dev-control-plane-token`
 * (clinic compose default) cannot hide `SATELLITE_EVENT_SERVICE_TOKEN` from droplet `.env`.
 * Hotel never sets CONTROL_PLANE in compose and already falls through to the event token.
 */
export function resolveControlPlaneBearerToken(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.CONTROL_PLANE_SERVICE_TOKEN,
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN,
    resolveSatelliteEventServiceToken(),
  ]
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean);
  const real = candidates.filter((t) => !FOLKLORE_S2S_TOKENS.has(t));
  return (real[0] || candidates[0] || "").trim();
}
