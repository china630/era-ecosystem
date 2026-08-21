import { getRuntimeConfigMemory } from "./runtime-config-memory";

/**
 * Orchestrator / control-plane base URL.
 * Prefer runtime-config (Sync desired state); env is bootstrap / emergency override only.
 */
export function resolveOrchestratorBaseUrl(opts?: {
  /** Default when neither memory nor env is set (local smoke). */
  fallback?: string;
}): string {
  const fromMem = getRuntimeConfigMemory().orchestratorEventUrl?.trim();
  if (fromMem) return fromMem.replace(/\/$/, "");

  const fromEnv = (
    process.env.ORCHESTRATOR_EVENT_URL?.trim() ||
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    ""
  );
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  return (opts?.fallback ?? "http://127.0.0.1:4100").replace(/\/$/, "");
}

/** Event / internal service token: memory first, then env bootstrap. */
export function resolveSatelliteEventServiceToken(): string {
  const fromMem = getRuntimeConfigMemory().satelliteEventServiceToken?.trim();
  if (fromMem) return fromMem;
  return (
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    ""
  );
}
