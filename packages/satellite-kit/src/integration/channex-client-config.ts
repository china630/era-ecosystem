/**
 * Control-plane Channex partner credentials — one key for all hotel properties.
 * Satellites must never store this in compose env.
 */

import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export type ChannexClientConfig = {
  apiBase: string;
  apiKey: string | null;
  hasApiKey: boolean;
  /** Super-Admin flag: ERA completed Channex PMS certification (not hotel env). */
  pmsCertified: boolean;
};

type CacheEntry = { at: number; value: ChannexClientConfig };

const TTL_MS = 60_000;
let cache: CacheEntry | null = null;

function baseUrl(): string {
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4000" });
}

function serviceToken(): string | undefined {
  return (
    resolveSatelliteEventServiceToken() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    undefined
  );
}

export async function fetchChannexClientConfig(opts?: {
  force?: boolean;
}): Promise<ChannexClientConfig> {
  if (!opts?.force && cache && Date.now() - cache.at < TTL_MS) {
    return cache.value;
  }

  const token = serviceToken();
  if (!token) {
    return {
      apiBase: "https://staging.channex.io/api/v1",
      apiKey: null,
      hasApiKey: false,
      pmsCertified: false,
    };
  }

  const url = `${baseUrl()}/internal/v1/vendors/channex/client-config`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
    },
  });
  if (!res.ok) {
    return {
      apiBase: "https://staging.channex.io/api/v1",
      apiKey: null,
      hasApiKey: false,
      pmsCertified: false,
    };
  }
  const json = (await res.json()) as ChannexClientConfig;
  const value: ChannexClientConfig = {
    apiBase: json.apiBase?.trim() || "https://staging.channex.io/api/v1",
    apiKey: json.apiKey?.trim() || null,
    hasApiKey: Boolean(json.hasApiKey && json.apiKey?.trim()),
    pmsCertified: Boolean(json.pmsCertified),
  };
  cache = { at: Date.now(), value };
  return value;
}

export function clearChannexClientConfigCache(): void {
  cache = null;
}
