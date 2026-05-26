"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Browser SSO handoff: signed query → POST /api/auth/sso/exchange → app home.
 */
export function SsoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = searchParams.get("email");
    const fullName = searchParams.get("fullName");
    const organizationId = searchParams.get("organizationId");
    const expiresAtRaw = searchParams.get("expiresAt");
    const signature = searchParams.get("signature");
    const financeRole = searchParams.get("financeRole") ?? undefined;

    if (!email || !fullName || !organizationId || !expiresAtRaw || !signature) {
      setError("Missing SSO parameters");
      return;
    }

    const expiresAt = Number.parseInt(expiresAtRaw, 10);
    if (!Number.isFinite(expiresAt)) {
      setError("Invalid expiresAt");
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await fetch("/api/auth/sso/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          fullName,
          organizationId,
          expiresAt,
          signature,
          financeRole,
        }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `SSO failed (${res.status})`);
        return;
      }
      router.replace("/");
      router.refresh();
    })().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "SSO failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-[#34495E]">ERA SSO</h1>
      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-4 text-sm text-[#7F8C8D]">Signing you in…</p>
      )}
    </main>
  );
}
