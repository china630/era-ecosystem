"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, ready, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    if (!user?.organizationId) {
      router.replace("/register-org");
      return;
    }
    router.replace("/");
  }, [ready, token, user, router]);

  if (ready && token) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await orchFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => "Login failed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: { id: string; email: string; organizationId?: string | null };
        claims?: { isSuperAdmin?: boolean; role?: string };
      };
      const claims =
        data.claims ??
        (() => {
          try {
            return JSON.parse(atob(data.accessToken.split(".")[1] ?? "")) as {
              isSuperAdmin?: boolean;
              role?: string;
            };
          } catch {
            return {};
          }
        })();
      login(data.accessToken, {
        id: data.user.id,
        email: data.user.email,
        organizationId: data.user.organizationId ?? null,
        role: claims.role ?? null,
        isSuperAdmin: Boolean(claims.isSuperAdmin),
      });
      router.replace(data.user.organizationId ? "/" : "/register-org");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold text-[#34495E]">ERA 365</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">Sign in to control plane</p>
      <form
        onSubmit={onSubmit}
        className={`${CARD_CONTAINER_CLASS} mt-6 space-y-3 p-6`}
      >
        <input
          type="email"
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className={`${PRIMARY_BUTTON_CLASS} w-full`}
          disabled={busy}
        >
          {busy ? "…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/register" className="text-[#2980B9] hover:underline">
          Create account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/register-org" className={SECONDARY_BUTTON_CLASS}>
          Register organization
        </Link>
      </p>
    </main>
  );
}
