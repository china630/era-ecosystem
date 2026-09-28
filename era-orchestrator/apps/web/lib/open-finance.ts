import { financeWebUrl } from "@era/satellite-kit/platform/industry-modules";
import type { SatelliteSsoTicket } from "@era/satellite-kit/auth/sso-launch";
import {
  ensureFreshOrchAccessToken,
  getOrchAccessToken,
  isAccessTokenUsable,
  orchFetch,
  tokenAlgorithm,
} from "./orch-api";

export { ensureFreshOrchAccessToken, getOrchAccessToken };

/**
 * Fetch a server-signed satellite SSO ticket. Signing happens in the orchestrator
 * API (which holds `ERA_SSO_SHARED_SECRET`); the browser only assembles the URL.
 */
export async function fetchSatelliteSsoTicket(
  accessToken: string,
  organizationId: string,
): Promise<SatelliteSsoTicket | null> {
  try {
    let token = accessToken;
    let res = await orchFetch("/auth/satellite-sso-ticket", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    // Match finance handoff: refresh once on 401 so satellite SSO does not silently fail.
    if (res.status === 401) {
      const fresh = await ensureFreshOrchAccessToken();
      if (!fresh) return null;
      token = fresh;
      res = await orchFetch("/auth/satellite-sso-ticket", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
    }
    if (!res.ok) return null;
    return (await res.json()) as SatelliteSsoTicket;
  } catch {
    return null;
  }
}

/**
 * Fetch owner-launcher base URL from orchestrator SoR (SatelliteEndpoint),
 * with server-side NEXT_PUBLIC_* / ERA_*_ORIGIN fallback for local-dev.
 */
export async function fetchSatelliteLaunchUrl(
  accessToken: string,
  satelliteKey: string,
): Promise<{ baseUrl: string; source: "registry" | "env" } | null> {
  try {
    const q = encodeURIComponent(satelliteKey);
    const res = await orchFetch(`/v1/satellites/launch-url?satelliteKey=${q}`, {
      method: "GET",
      token: accessToken,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      baseUrl?: string;
      source?: "registry" | "env";
    };
    if (!data.baseUrl) return null;
    return {
      baseUrl: data.baseUrl.replace(/\/$/, ""),
      source: data.source === "registry" ? "registry" : "env",
    };
  } catch {
    return null;
  }
}

export type FinanceHandoffResult =
  | { ok: true; url: string }
  | { ok: false; reason: "needs_relogin" | "finance_unavailable" | "handoff_failed" };

const SAFE_RELATIVE_PATH = /^\/[A-Za-z0-9/_?=&%-]*$/;

export function isSafeFinanceHandoffNextPath(nextPath: string): boolean {
  return SAFE_RELATIVE_PATH.test(nextPath);
}

/**
 * One-time ticket handoff (preferred). Legacy `?token=` only for HS256 tokens —
 * RS256 control-plane JWTs are rejected by Finance `/auth/me` and must never be
 * passed in the query string.
 */
export async function buildFinanceHandoffUrl(
  accessToken?: string | null,
  nextPath?: string,
): Promise<FinanceHandoffResult> {
  const base = financeWebUrl();
  if (!base) return { ok: false, reason: "finance_unavailable" };

  const token = accessToken ?? (await ensureFreshOrchAccessToken());
  if (!token) return { ok: false, reason: "needs_relogin" };

  const url = new URL("/auth/cp-handoff", base.replace(/\/$/, ""));
  if (nextPath && isSafeFinanceHandoffNextPath(nextPath)) {
    url.searchParams.set("next", nextPath);
  }
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
