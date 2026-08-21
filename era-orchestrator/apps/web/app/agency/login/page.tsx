"use client";

import { useMemo, useState } from "react";
import { orchFetch } from "../../../lib/orch-api";

type Property = {
  grantId: string;
  organizationId: string;
  organizationName: string;
  agencyId: string;
  agencyCode: string | null;
  agencyVoen: string;
  hotelBaseUrl: string | null;
};

export default function AgencyPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "Agency portal", []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid email or password");
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        properties: Property[];
      };
      setToken(data.accessToken);
      setProperties(data.properties ?? []);
      if ((data.properties ?? []).length === 1 && data.properties[0]) {
        await openProperty(data.accessToken, data.properties[0].grantId);
      }
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function openProperty(accessToken: string, grantId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/properties/pick", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        setError("Could not open hotel");
        return;
      }
      const ticket = (await res.json()) as { launchUrl?: string | null };
      if (!ticket.launchUrl) {
        setError("Hotel URL is not configured for this organization");
        return;
      }
      window.location.assign(ticket.launchUrl);
    } catch {
      setError("Could not open hotel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold text-[#2C3E50]">{title}</h1>
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
          <p className="text-sm text-[#7F8C8D]">Choose a hotel</p>
          {properties.length === 0 ? (
            <p className="text-sm text-amber-700">
              No active hotel grants. Ask the hotel to invite your email (VÖEN
              required).
            </p>
          ) : (
            properties.map((p) => (
              <button
                key={p.grantId}
                type="button"
                disabled={busy}
                onClick={() => token && openProperty(token, p.grantId)}
                className="rounded border border-[#BDC3C7] px-4 py-3 text-left hover:bg-[#ECF0F1]"
              >
                <div className="font-medium">{p.organizationName}</div>
                <div className="text-xs text-[#7F8C8D]">
                  {p.agencyCode ?? p.agencyId} · VÖEN {p.agencyVoen}
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
