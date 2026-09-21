"use client";

import { useMemo, useState } from "react";
import { orchFetch } from "../../../lib/orch-api";

type BuyerOrg = {
  grantId: string;
  organizationId: string;
  organizationName: string;
  counterpartyId: string;
  voen: string;
  financeBaseUrl: string | null;
};

export default function BuyerPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<BuyerOrg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "Buyer portal", []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/buyer-portal/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid email or password");
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        orgs: BuyerOrg[];
      };
      setToken(data.accessToken);
      setOrgs(data.orgs ?? []);
      if ((data.orgs ?? []).length === 1 && data.orgs[0]) {
        await openOrg(data.accessToken, data.orgs[0].grantId);
      }
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function openOrg(accessToken: string, grantId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/buyer-portal/orgs/pick", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        setError("Could not open seller organization");
        return;
      }
      const ticket = (await res.json()) as { launchUrl?: string | null };
      if (!ticket.launchUrl) {
        setError("Finance URL is not configured for this organization");
        return;
      }
      window.location.assign(ticket.launchUrl);
    } catch {
      setError("Could not open seller organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#2C3E50]">{title}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">Trade credit cabinet</p>
      </div>
      {!token ? (
        <form onSubmit={onLogin} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              className="rounded border border-[#BDC3C7] px-3 py-2"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              className="rounded border border-[#BDC3C7] px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={8}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-[#2980B9] px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {busy ? "…" : "Sign in"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#7F8C8D]">Choose a seller organization</p>
          {orgs.length === 0 ? (
            <p className="text-sm text-amber-700">
              No active seller grants. Ask the seller to invite your email (VÖEN
              required).
            </p>
          ) : (
            orgs.map((o) => (
              <button
                key={o.grantId}
                type="button"
                disabled={busy}
                onClick={() => token && openOrg(token, o.grantId)}
                className="rounded border border-[#BDC3C7] px-4 py-3 text-left hover:bg-[#ECF0F1]"
              >
                <div className="font-medium">{o.organizationName}</div>
                <div className="text-xs text-[#7F8C8D]">
                  VÖEN {o.voen}
                  {o.financeBaseUrl ? ` · ${o.financeBaseUrl}` : ""}
                </div>
              </button>
            ))
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </main>
  );
}
