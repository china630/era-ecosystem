import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "./resolve-orchestrator-url";

export type PeerSatelliteUrlSource = "registry" | "env_fallback" | "cache";

export type ResolvedPeerSatelliteUrl = {
  baseUrl: string;
  satelliteKey: string;
  organizationId: string;
  source: PeerSatelliteUrlSource;
};

export class PeerSatelliteUrlError extends Error {
  readonly code: "PEER_ORG_MISSING" | "PEER_TOKEN_MISSING" | "PEER_UNRESOLVED";

  constructor(code: PeerSatelliteUrlError["code"], message: string) {
    super(message);
    this.name = "PeerSatelliteUrlError";
    this.code = code;
  }
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: ResolvedPeerSatelliteUrl }>();

/** Legacy bootstrap keys when CP registry is empty (local / one-release dual-read). */
const ENV_FALLBACKS: Record<string, readonly string[]> = {
  industry_hotel_pms: [
    "HOTEL_PMS_API_URL",
    "ERA_HOTEL_PMS_INTERNAL_URL",
    "HOTEL_PMS_URL",
    "ERA_HOTEL_PMS_ORIGIN",
    "NEXT_PUBLIC_SATELLITE_HOTEL_URL",
  ],
  industry_clinic: ["CLINIC_API_URL", "ERA_CLINIC_ORIGIN", "NEXT_PUBLIC_SATELLITE_CLINIC_URL"],
  industry_fnb_pos: [
    "FNB_POS_API_URL",
    "ERA_FNB_POS_ORIGIN",
    "NEXT_PUBLIC_SATELLITE_FNB_POS_URL",
  ],
  industry_retail: ["RETAIL_API_URL", "ERA_RETAIL_ORIGIN", "NEXT_PUBLIC_SATELLITE_RETAIL_URL"],
};

function allowEnvFallback(): boolean {
  if (process.env.ERA_PEER_URL_ENV_FALLBACK === "1") return true;
  if (process.env.ERA_PEER_URL_ENV_FALLBACK === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function envFallbackBase(satelliteKey: string): string | null {
  const keys = ENV_FALLBACKS[satelliteKey] ?? [];
  for (const k of keys) {
    const raw = process.env[k]?.trim();
    if (raw) return raw.replace(/\/$/, "");
  }
  return null;
}

function cacheKey(organizationId: string, satelliteKey: string): string {
  return `${organizationId}|${satelliteKey}`;
}

/** Test helper — clears peer URL memory cache. */
export function clearPeerSatelliteUrlCache(): void {
  cache.clear();
}

/**
 * Resolve another satellite's S2S base URL for this org.
 * SoR = orchestrator SatelliteEndpoint (hairpin-aware). Env is bootstrap only.
 * ADR: docs/adr/satellite-peer-url-resolution.md
 */
export async function resolvePeerSatelliteBaseUrl(input: {
  organizationId: string;
  satelliteKey: string;
  /** Override orchestrator base (tests). */
  orchestratorBaseUrl?: string;
  /** Skip memory cache. */
  bypassCache?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ResolvedPeerSatelliteUrl> {
  const organizationId = input.organizationId.trim();
  const satelliteKey = input.satelliteKey.trim();
  if (!organizationId) {
    throw new PeerSatelliteUrlError("PEER_ORG_MISSING", "organizationId required");
  }
  if (!satelliteKey) {
    throw new PeerSatelliteUrlError("PEER_UNRESOLVED", "satelliteKey required");
  }

  const key = cacheKey(organizationId, satelliteKey);
  if (!input.bypassCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.value, source: "cache" };
    }
  }

  const token = resolveSatelliteEventServiceToken();
  const orch = (input.orchestratorBaseUrl ?? resolveOrchestratorBaseUrl()).replace(
    /\/$/,
    "",
  );
  const fetchFn = input.fetchImpl ?? fetch;

  if (token && orch) {
    try {
      const url = new URL(`${orch}/v1/internal/satellites/peer-endpoint`);
      url.searchParams.set("satelliteKey", satelliteKey);
      const res = await fetchFn(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Organization-Id": organizationId,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          baseUrl?: string;
          source?: "registry" | "env_fallback";
        };
        const baseUrl = body.baseUrl?.trim().replace(/\/$/, "") ?? "";
        if (baseUrl) {
          const value: ResolvedPeerSatelliteUrl = {
            baseUrl,
            satelliteKey,
            organizationId,
            source: body.source === "env_fallback" ? "env_fallback" : "registry",
          };
          cache.set(key, { at: Date.now(), value });
          return value;
        }
      }
    } catch {
      // fall through to env bootstrap
    }
  }

  if (allowEnvFallback()) {
    const fromEnv = envFallbackBase(satelliteKey);
    if (fromEnv) {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          `[era] peer URL env fallback for ${satelliteKey} (set SatelliteEndpoint; ERA_PEER_URL_ENV_FALLBACK=1)`,
        );
      }
      const value: ResolvedPeerSatelliteUrl = {
        baseUrl: fromEnv,
        satelliteKey,
        organizationId,
        source: "env_fallback",
      };
      cache.set(key, { at: Date.now(), value });
      return value;
    }
  }

  if (!token) {
    throw new PeerSatelliteUrlError(
      "PEER_TOKEN_MISSING",
      "SATELLITE_EVENT_SERVICE_TOKEN / control-plane token missing for peer URL resolve",
    );
  }

  throw new PeerSatelliteUrlError(
    "PEER_UNRESOLVED",
    `No peer endpoint for ${satelliteKey} (org=${organizationId}). Set SatelliteEndpoint or local env fallback.`,
  );
}

/** Convenience: base URL string only. */
export async function peerSatelliteBaseUrl(
  organizationId: string,
  satelliteKey: string,
): Promise<string> {
  const resolved = await resolvePeerSatelliteBaseUrl({
    organizationId,
    satelliteKey,
  });
  return resolved.baseUrl;
}

export const PEER_SATELLITE_HOTEL = "industry_hotel_pms";
