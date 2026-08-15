"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import type { AuthUser, OrgSummary } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";
import { setControlPlaneTokens } from "../../../lib/session-keys";

function HandoffInner() {
  const searchParams = useSearchParams();
  const { login, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const ticket = searchParams.get("ticket")?.trim();
    const legacyToken = searchParams.get("token")?.trim();

    void (async () => {
      if (ticket) {
        // Same-origin: finance-web proxies /cp/* → orchestrator API (avoids CORS + wrong-port).
        let orchAccessToken: string;
        let orchRefreshToken: string | null = null;
        try {
          const res = await fetch("/cp/auth/finance-handoff/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket }),
          });
          if (!res.ok) {
            setError("Handoff ticket invalid or expired");
            return;
          }
          const redeemed = (await res.json()) as {
            accessToken: string;
            refreshToken?: string;
          };
          orchAccessToken = redeemed.accessToken;
          orchRefreshToken = redeemed.refreshToken ?? null;
        } catch {
          setError("Handoff ticket invalid or expired");
          return;
        }
        // Mint Finance-local session first; keep CP tokens for billing proxies
        // (login() clears stale CP JWTs from a prior local password session).
        let provRes: Response;
        try {
          provRes = await apiFetch("/api/auth/cp-provision", {
            method: "POST",
            headers: { Authorization: `Bearer ${orchAccessToken}` },
          });
        } catch {
          setError("Session invalid — use Orchestrator login");
          return;
        }
        if (!provRes.ok) {
          setError("Session invalid — use Orchestrator login");
          return;
        }
        const data = (await provRes.json()) as {
          accessToken: string;
          user: AuthUser;
          organizations: OrgSummary[];
        };
        login(data.accessToken, data.user, data.organizations);
        setControlPlaneTokens(orchAccessToken, orchRefreshToken);
        // Hard-navigate so /home loads once with the freshly written session
        // cookie + per-tab sessionStorage present. An SPA router.replace here
        // rendered /home before middleware/providers had the new session,
        // producing an empty/menu-less page that needed manual reloads.
        window.location.replace("/home");
        return;
      }

      if (!legacyToken) {
        setError("Missing handoff ticket");
        return;
      }
      console.warn(
        "[cp-handoff] Legacy ?token= query is deprecated; use Orchestrator ticket handoff.",
      );
      try {
        const payload = JSON.parse(atob(legacyToken.split(".")[1] ?? "")) as {
          exp?: number;
        };
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          setError("Token expired");
          return;
        }
      } catch {
        setError("Invalid token");
        return;
      }

      // Prefer cp-provision (accepts RS256 CP JWT via JWKS). Legacy /auth/me only
      // accepts Finance-local HS256 tokens and fails for Orchestrator RS256 SSO.
      let provRes: Response;
      try {
        provRes = await apiFetch("/api/auth/cp-provision", {
          method: "POST",
          headers: { Authorization: `Bearer ${legacyToken}` },
        });
      } catch {
        setError("Session invalid — use Orchestrator login");
        return;
      }
      if (!provRes.ok) {
        setError("Session invalid — use Orchestrator login");
        return;
      }
      const data = (await provRes.json()) as {
        accessToken: string;
        user: AuthUser;
        organizations: OrgSummary[];
      };
      login(data.accessToken, data.user, data.organizations);
      setControlPlaneTokens(legacyToken, null);
      window.location.replace("/home");
    })();
  }, [ready, searchParams, login]);

  return (
    <main className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold text-[#34495E]">ERA Finance</h1>
      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-4 text-sm text-[#7F8C8D]">Signing in from Orchestrator…</p>
      )}
    </main>
  );
}

export default function CpHandoffPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <HandoffInner />
    </Suspense>
  );
}
