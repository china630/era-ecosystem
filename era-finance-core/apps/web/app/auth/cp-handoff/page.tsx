"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import type { AuthUser, OrgSummary } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";

const ORCH_API =
  process.env.NEXT_PUBLIC_ORCH_API_URL ?? "http://127.0.0.1:4100";

function HandoffInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const ticket = searchParams.get("ticket")?.trim();
    const legacyToken = searchParams.get("token")?.trim();

    void (async () => {
      if (ticket) {
        const res = await fetch(
          `${ORCH_API.replace(/\/$/, "")}/auth/finance-handoff/redeem`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket }),
          },
        );
        if (!res.ok) {
          setError("Handoff ticket invalid or expired");
          return;
        }
        const tokens = (await res.json()) as { accessToken: string };
        const meRes = await apiFetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        if (!meRes.ok) {
          setError("Session invalid — use Orchestrator login");
          return;
        }
        const data = (await meRes.json()) as {
          user: AuthUser;
          organizations: OrgSummary[];
        };
        login(tokens.accessToken, data.user, data.organizations);
        router.replace(data.user.organizationId ? "/home" : "/companies");
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

      const res = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${legacyToken}` },
      });
      if (!res.ok) {
        setError("Session invalid — use Orchestrator login");
        return;
      }
      const data = (await res.json()) as {
        user: AuthUser;
        organizations: OrgSummary[];
      };
      login(legacyToken, data.user, data.organizations);
      router.replace(data.user.organizationId ? "/home" : "/companies");
    })();
  }, [ready, searchParams, login, router]);

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
