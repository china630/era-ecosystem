import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

/**
 * Pull SHARED pool org membership from orchestrator SoR
 * (`GET /api/v1/internal/satellite-pool/members`).
 * Returns [] when orch URL/token/baseUrl missing or request fails.
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
    process.env.ERA_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const satelliteKey = input.satelliteKey.trim();
  if (!orch || !token || !baseUrl || !satelliteKey) return [];

  const url = new URL(`${orch.replace(/\/$/, "")}/api/v1/internal/satellite-pool/members`);
  url.searchParams.set("satelliteKey", satelliteKey);
  url.searchParams.set("baseUrl", baseUrl);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
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
