export const ORCH_API_URL =
  process.env.NEXT_PUBLIC_ORCH_API_URL ?? "http://127.0.0.1:4000";

export const ORCH_TOKEN_KEY = "era_orch_access_token";
export const ORCH_REFRESH_KEY = "era_orch_refresh_token";

export function getOrchAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORCH_TOKEN_KEY);
}

export function getOrchRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORCH_REFRESH_KEY);
}

export function setOrchTokens(
  accessToken: string,
  refreshToken?: string | null,
): void {
  if (typeof window === "undefined") return;
  sessionExpiredLatch = false;
  localStorage.setItem(ORCH_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(ORCH_REFRESH_KEY, refreshToken);
  }
}

export function clearOrchTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ORCH_TOKEN_KEY);
  localStorage.removeItem(ORCH_REFRESH_KEY);
}

function decodeJwtJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function accessTokenExpiresAtMs(token: string): number | null {
  const payload = decodeJwtJsonSegment(token.split(".")[1] ?? "");
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

export function tokenAlgorithm(token: string): string | null {
  const header = decodeJwtJsonSegment(token.split(".")[0] ?? "");
  return typeof header?.alg === "string" ? header.alg : null;
}

/** True when JWT `exp` is farther than `skewMs` (default 2 min). Missing `exp` → try the call. */
export function isAccessTokenUsable(token: string, skewMs = 120_000): boolean {
  const exp = accessTokenExpiresAtMs(token);
  if (exp == null) return true;
  return exp - Date.now() > skewMs;
}

type OrchSessionListener = {
  onExpired?: () => void;
  onRefreshed?: (accessToken: string) => void;
};

const sessionListeners = new Set<OrchSessionListener>();
let sessionExpiredLatch = false;
let refreshInFlight: Promise<string | null> | null = null;

export function subscribeOrchSession(listener: OrchSessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function notifyOrchSessionExpired(): void {
  if (sessionExpiredLatch) return;
  sessionExpiredLatch = true;
  clearOrchTokens();
  for (const listener of sessionListeners) {
    listener.onExpired?.();
  }
}

async function performRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = getOrchRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await orchFetch("/auth/token/refresh", {
      method: "POST",
      skipAuthRetry: true,
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      notifyOrchSessionExpired();
      return null;
    }
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) {
      notifyOrchSessionExpired();
      return null;
    }
    setOrchTokens(data.accessToken, data.refreshToken ?? refreshToken);
    for (const listener of sessionListeners) {
      listener.onRefreshed?.(data.accessToken);
    }
    return data.accessToken;
  } catch {
    return null;
  }
}

/** Rotate access JWT. Dedupes concurrent callers. `null` means re-login. */
export async function refreshOrchAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * Prefer a still-valid access token; otherwise refresh.
 * Returns null when the user must sign in again.
 */
export async function ensureFreshOrchAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const current = getOrchAccessToken();
  if (current && isAccessTokenUsable(current)) {
    return current;
  }
  const refreshed = await refreshOrchAccessToken();
  if (refreshed) return refreshed;
  if (current && isAccessTokenUsable(current, 0)) return current;
  return null;
}

export type OrchFetchInit = RequestInit & {
  token?: string | null;
  /** Skip 401 → refresh → retry (refresh endpoint itself). */
  skipAuthRetry?: boolean;
};

export async function orchFetch(
  path: string,
  init: OrchFetchInit = {},
): Promise<Response> {
  const { token, skipAuthRetry, ...rest } = init;

  const send = (bearer?: string | null) => {
    const headers = new Headers(rest.headers);
    if (!headers.has("Content-Type") && rest.body) {
      headers.set("Content-Type", "application/json");
    }
    if (bearer) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }
    const url = `${ORCH_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    return fetch(url, { ...rest, headers });
  };

  const first = await send(token);
  if (skipAuthRetry || !token || first.status !== 401) {
    return first;
  }

  const fresh = await refreshOrchAccessToken();
  if (!fresh) {
    notifyOrchSessionExpired();
    return first;
  }
  const retry = await send(fresh);
  if (retry.status === 401) {
    notifyOrchSessionExpired();
  }
  return retry;
}
