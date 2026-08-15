import { financeWebUrl } from "@era/satellite-kit/platform/industry-modules";
import type { SatelliteSsoTicket } from "@era/satellite-kit/auth/sso-launch";
import {
  ORCH_REFRESH_KEY,
  ORCH_TOKEN_KEY,
  getOrchAccessToken,
  getOrchRefreshToken,
  orchFetch,
  setOrchTokens,
} from "./orch-api";

export { getOrchAccessToken };

/**
 * Fetch a server-signed satellite SSO ticket. Signing happens in the orchestrator
 * API (which holds `ERA_SSO_SHARED_SECRET`); the browser only assembles the URL.
 */
export async function fetchSatelliteSsoTicket(
  accessToken: string,
  organizationId: string,
): Promise<SatelliteSsoTicket | null> {
  try {
    const res = await orchFetch("/auth/satellite-sso-ticket", {
      method: "POST",
      token: accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SatelliteSsoTicket;
  } catch {
    return null;
  }
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

function accessTokenExpiresAtMs(token: string): number | null {
  const payload = decodeJwtJsonSegment(token.split(".")[1] ?? "");
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

function tokenAlgorithm(token: string): string | null {
  const header = decodeJwtJsonSegment(token.split(".")[0] ?? "");
  return typeof header?.alg === "string" ? header.alg : null;
}

function isAccessTokenUsable(token: string, skewMs = 120_000): boolean {
  const exp = accessTokenExpiresAtMs(token);
  // If exp cannot be read, still attempt the call — server is source of truth.
  if (exp == null) return true;
  return exp - Date.now() > skewMs;
}

/**
 * Ensure a fresh Orchestrator access token before Finance / satellite launch.
 * Prefers refresh when the access token is missing, expired, or near expiry.
 * Returns null when re-login is required.
 */
export async function ensureFreshOrchAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const current = getOrchAccessToken();
  if (current && isAccessTokenUsable(current)) {
    return current;
  }

  const refreshToken = getOrchRefreshToken();
  if (!refreshToken) {
    if (current && isAccessTokenUsable(current, 0)) return current;
    return null;
  }

  try {
    const res = await orchFetch("/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem(ORCH_TOKEN_KEY);
      localStorage.removeItem(ORCH_REFRESH_KEY);
      return null;
    }
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) return null;
    setOrchTokens(data.accessToken, data.refreshToken ?? refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export type FinanceHandoffResult =
  | { ok: true; url: string }
  | { ok: false; reason: "needs_relogin" | "finance_unavailable" | "handoff_failed" };

/**
 * One-time ticket handoff (preferred). Legacy `?token=` only for HS256 tokens —
 * RS256 control-plane JWTs are rejected by Finance `/auth/me` and must never be
 * passed in the query string.
 */
export async function buildFinanceHandoffUrl(
  accessToken?: string | null,
): Promise<FinanceHandoffResult> {
  const base = financeWebUrl();
  if (!base) return { ok: false, reason: "finance_unavailable" };

  const token = accessToken ?? (await ensureFreshOrchAccessToken());
  if (!token) return { ok: false, reason: "needs_relogin" };

  const url = new URL("/auth/cp-handoff", base.replace(/\/$/, ""));
  try {
    const res = await orchFetch("/auth/finance-handoff", {
      method: "POST",
      token,
    });
    if (res.ok) {
      const data = (await res.json()) as { ticket?: string };
      if (data.ticket) {
        url.searchParams.set("ticket", data.ticket);
        return { ok: true, url: url.toString() };
      }
      return { ok: false, reason: "handoff_failed" };
    }
    if (res.status === 401) {
      const refreshed = await ensureFreshOrchAccessToken();
      if (!refreshed || refreshed === token) {
        return { ok: false, reason: "needs_relogin" };
      }
      const retry = await orchFetch("/auth/finance-handoff", {
        method: "POST",
        token: refreshed,
      });
      if (retry.ok) {
        const data = (await retry.json()) as { ticket?: string };
        if (data.ticket) {
          url.searchParams.set("ticket", data.ticket);
          return { ok: true, url: url.toString() };
        }
      }
      if (retry.status === 401) {
        return { ok: false, reason: "needs_relogin" };
      }
      return { ok: false, reason: "handoff_failed" };
    }
    return { ok: false, reason: "handoff_failed" };
  } catch {
    /* network — only HS256 legacy fallback below */
  }

  // Legacy query token: Finance JwtStrategy is HS256-only for local sessions.
  // Never put an RS256 CP token in ?token= — cp-provision path requires a ticket.
  if (tokenAlgorithm(token) !== "HS256") {
    return { ok: false, reason: "handoff_failed" };
  }
  if (!isAccessTokenUsable(token, 0)) {
    return { ok: false, reason: "needs_relogin" };
  }
  url.searchParams.set("token", token);
  return { ok: true, url: url.toString() };
}
