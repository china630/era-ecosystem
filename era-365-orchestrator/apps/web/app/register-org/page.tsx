"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

export default function RegisterOrgPage() {
  const router = useRouter();
  const { login, token, ready, user } = useAuth();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.organizationId) {
      router.replace("/");
    }
  }, [ready, token, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const res = await orchFetch("/auth/register-organization", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim(), taxId: taxId.trim() }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => "Registration failed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
        };
      };
      login(data.accessToken, {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: data.claims.isSuperAdmin,
      });
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <main className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold">Register organization</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">VÖEN registered via platform MDM</p>
      <form
        onSubmit={onSubmit}
        className={`${CARD_CONTAINER_CLASS} mt-6 space-y-3 p-6`}
      >
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="VÖEN / Tax ID"
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full`} disabled={busy}>
          Create organization
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/" className="text-[#2980B9]">
          Back
        </Link>
      </p>
    </main>
  );
}
