"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function BuyerSsoCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = params.get("email");
    const organizationId = params.get("organizationId");
    const counterpartyId = params.get("counterpartyId");
    const expiresAt = params.get("expiresAt");
    const signature = params.get("signature");
    const jti = params.get("jti");
    const fullName = params.get("fullName") ?? undefined;
    if (
      !email ||
      !organizationId ||
      !counterpartyId ||
      !expiresAt ||
      !signature
    ) {
      setError("Missing SSO parameters");
      return;
    }
    void (async () => {
      const res = await fetch("/api/auth/buyer-sso/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          organizationId,
          counterpartyId,
          expiresAt: Number(expiresAt),
          signature,
          jti: jti ?? undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Buyer SSO failed");
        return;
      }
      router.replace("/buyer");
    })();
  }, [params, router]);

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold">Buyer SSO</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }
  return (
    <main className="p-8">
      <p>Signing in…</p>
    </main>
  );
}

export default function BuyerSsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          <p>Signing in…</p>
        </main>
      }
    >
      <BuyerSsoCallbackInner />
    </Suspense>
  );
}
