export type SatelliteRuntimeConfig = {
  organizationId?: string;
  orchestratorEventUrl?: string;
  publicBaseUrl?: string;
  platformSuperAdminEmails?: string[];
  /** Pushed SSO shared secret (same value as orch ERA_SSO_SHARED_SECRET). */
  ssoSharedSecret?: string;
  satelliteEventServiceToken?: string;
  /** Last known entitlements from orchestrator Sync (air-gap fail-closed cache). */
  activeModules?: string[];
  /** Optional hotelModules boolean map from subscription snapshot. */
  hotelModules?: Record<string, boolean>;
  /**
   * Placement hint from orchestrator (informational / license defaults).
   * MUST NEVER disable or skip the organizationId tenant filter — topology is packaging.
   */
  deploymentTopology?: "SHARED" | "DEDICATED" | "ONPREM";
  /** Commercial / edition label from subscription (string; not a sell gate). */
  edition?: string;
  updatedAt?: string;
  updatedBy?: string;
};

let runtimeConfig: SatelliteRuntimeConfig = {};

export function getRuntimeConfigMemory(): SatelliteRuntimeConfig {
  return runtimeConfig;
}

export function setRuntimeConfigMemory(cfg: SatelliteRuntimeConfig): void {
  runtimeConfig = cfg;
}

export function applyEnvSideEffects(cfg: SatelliteRuntimeConfig): void {
  if (cfg.organizationId?.trim()) {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = cfg.organizationId.trim();
  }
  if (cfg.orchestratorEventUrl?.trim()) {
    process.env.ORCHESTRATOR_EVENT_URL = cfg.orchestratorEventUrl.trim();
    process.env.ORCHESTRATOR_URL = cfg.orchestratorEventUrl.trim();
  }
  if (cfg.publicBaseUrl?.trim()) {
    process.env.ERA_PUBLIC_BASE_URL = cfg.publicBaseUrl.trim();
  }
  if (cfg.platformSuperAdminEmails?.length) {
    process.env.PLATFORM_SUPER_ADMIN_EMAILS = cfg.platformSuperAdminEmails
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .join(",");
  }
  if (cfg.ssoSharedSecret?.trim()) {
    process.env.ERA_SSO_SHARED_SECRET = cfg.ssoSharedSecret.trim();
  }
  if (cfg.satelliteEventServiceToken?.trim()) {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = cfg.satelliteEventServiceToken.trim();
  }
}

/** Memory + env only (no fs). Safe for Next webpack / SSO import graph. */
export function getRuntimeSsoSharedSecret(): string | undefined {
  const fromMem = runtimeConfig.ssoSharedSecret?.trim();
  if (fromMem) return fromMem;
  return process.env.ERA_SSO_SHARED_SECRET?.trim() || undefined;
}

export function resetRuntimeConfigMemoryForTests(): void {
  runtimeConfig = {};
}
