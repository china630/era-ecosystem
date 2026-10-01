import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";
import { getRuntimeConfigMemory } from "../tenancy/runtime-config-memory";

export type SatellitePoolRegistryErrorReason =
  | "orch_url_missing"
  | "service_token_missing"
  | "public_base_url_missing"
  | "satellite_key_missing"
  | "unauthorized"
  | "http_error"
  | "network_error";

export class SatellitePoolRegistryError extends Error {
  readonly code = "SATELLITE_POOL_REGISTRY";
  readonly reason: SatellitePoolRegistryErrorReason;
  readonly status?: number;
  /** Network drop / timeout / 5xx / 429 — worth another attempt. */
  readonly retryable: boolean;

  constructor(
    reason: SatellitePoolRegistryErrorReason,
    message: string,
    opts?: { status?: number; retryable?: boolean },
  ) {
    super(message);
    this.name = "SatellitePoolRegistryError";
    this.reason = reason;
    this.status = opts?.status;
    this.retryable = Boolean(opts?.retryable);
  }
}

/**
 * Pull SHARED pool org membership from orchestrator SoR
 * (`GET /v1/internal/satellite-pool/members` — Nest has no `/api` global prefix).
 * Throws `SatellitePoolRegistryError` when orch URL / token / baseUrl is missing
 * or the request fails. An empty array means the registry has no enabled rows
 * for this process URL (foreign URL or disabled endpoint).
 */
export async function fetchPoolOrganizationIdsFromOrch(input: {
  satelliteKey: string;
  /** Public base URL of this satellite process (matches SatelliteEndpoint.baseUrl). */
  baseUrl?: string;
}): Promise<string[]> {
  const orch = resolveOrchestratorBaseUrl({ fallback: "" });
  const token = resolveSatelliteEventServiceToken();
  const baseUrl = (
    input.baseUrl?.trim() ||
    getRuntimeConfigMemory().publicBaseUrl?.trim() ||
    process.env.ERA_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const satelliteKey = input.satelliteKey.trim();
  if (!orch) {
    throw new SatellitePoolRegistryError("orch_url_missing", "Orchestrator URL is not configured");
  }
  if (!token) {
    throw new SatellitePoolRegistryError(
      "service_token_missing",
      "SATELLITE_EVENT_SERVICE_TOKEN is not configured",
    );
  }
  if (!baseUrl) {
    throw new SatellitePoolRegistryError(
      "public_base_url_missing",
      "Satellite public base URL is not configured",
    );
  }
  if (!satelliteKey) {
    throw new SatellitePoolRegistryError("satellite_key_missing", "satelliteKey required");
  }

  const url = new URL(`${orch.replace(/\/$/, "")}/v1/internal/satellite-pool/members`);
  url.searchParams.set("satelliteKey", satelliteKey);
  url.searchParams.set("baseUrl", baseUrl);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new SatellitePoolRegistryError(
      "network_error",
      `Pool registry request failed: ${err instanceof Error ? err.message : String(err)}`,
      { retryable: true },
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new SatellitePoolRegistryError(
      "unauthorized",
      `Pool registry rejected service token (${res.status})`,
      { status: res.status },
    );
  }
  if (!res.ok) {
    throw new SatellitePoolRegistryError(
      "http_error",
      `Pool registry responded ${res.status}`,
      { status: res.status, retryable: res.status >= 500 || res.status === 429 },
    );
  }
  const body = (await res.json()) as { organizationIds?: unknown };
  const ids = Array.isArray(body.organizationIds) ? body.organizationIds : [];
  return [
    ...new Set(
      ids
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean),
    ),
  ];
}
