"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await orchFetch("/auth/register-user", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      if (!res.ok) {
        setError(await res.text().catch(() => "Registration failed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: { id: string; email: string; organizationId: string | null };
        claims?: { isSuperAdmin?: boolean };
      };
      login(data.accessToken, {
        id: data.user.id,
        email: data.user.email,
        organizationId: null,
        isSuperAdmin: data.claims?.isSuperAdmin,
      });
      router.replace("/register-org");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <form
        onSubmit={onSubmit}
        className={`${CARD_CONTAINER_CLASS} mt-6 space-y-3 p-6`}
      >
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
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
          placeholder="Password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full`} disabled={busy}>
          Register
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-[#2980B9]">
          Already have an account?
        </Link>
      </p>
    </main>
  );
}
