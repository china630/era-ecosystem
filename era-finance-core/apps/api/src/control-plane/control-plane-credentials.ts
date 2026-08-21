import type { ConfigService } from "@nestjs/config";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";

/**
 * Canonical Finance → Orchestrator service credentials.
 * Prefer runtime-config (kit memory) after Sync; env is install bootstrap only.
 * Prefer CONTROL_PLANE_SERVICE_TOKEN; accept ORCHESTRATOR_INTERNAL_SERVICE_TOKEN alias
 * (Nafta compose drift). Never invent a third name without updating ECOSYSTEM_URLS.
 */
export function resolveControlPlaneServiceToken(
  config?: ConfigService | null,
): string {
  const fromKit = resolveSatelliteEventServiceToken();
  if (fromKit) return fromKit;

  if (config) {
    return (
      config.get<string>("CONTROL_PLANE_SERVICE_TOKEN")?.trim() ||
      config.get<string>("ORCHESTRATOR_INTERNAL_SERVICE_TOKEN")?.trim() ||
      config.get<string>("ORCHESTRATOR_SERVICE_TOKEN")?.trim() ||
      ""
    );
  }
  return (
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.ORCHESTRATOR_SERVICE_TOKEN?.trim() ||
    ""
  );
}

/**
 * Orchestrator / control-plane base URL.
 * Order: runtime-config memory → kit env bootstrap → ORCHESTRATOR_INTERNAL_URL alias.
 * Do not cache forever at Nest module construct — Sync may refresh memory.
 */
export function resolveOrchestratorInternalUrl(
  config?: ConfigService | null,
): string {
  const fromKit = resolveOrchestratorBaseUrl({ fallback: "" });
  if (fromKit) return fromKit;

  if (config) {
    return (
      config.get<string>("ORCHESTRATOR_INTERNAL_URL")?.trim() ||
      config.get<string>("CONTROL_PLANE_URL")?.trim() ||
      config.get<string>("ORCHESTRATOR_URL")?.trim() ||
      ""
    ).replace(/\/$/, "");
  }
  return (
    process.env.ORCHESTRATOR_INTERNAL_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    process.env.ORCHESTRATOR_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

export function controlPlaneDiagnostics(config?: ConfigService | null): {
  orchestratorInternalUrlConfigured: boolean;
  controlPlaneServiceTokenConfigured: boolean;
  piiEncryptionKeyConfigured: boolean;
  piiBlindIndexKeyConfigured: boolean;
} {
  const get = (k: string) =>
    (config?.get<string>(k) ?? process.env[k] ?? "").trim();
  return {
    orchestratorInternalUrlConfigured: Boolean(
      resolveOrchestratorInternalUrl(config),
    ),
    controlPlaneServiceTokenConfigured: Boolean(
      resolveControlPlaneServiceToken(config),
    ),
    piiEncryptionKeyConfigured: Boolean(get("PII_ENCRYPTION_KEY")),
    piiBlindIndexKeyConfigured: Boolean(get("PII_BLIND_INDEX_KEY")),
  };
}
