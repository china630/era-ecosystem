"use client";

import { useState } from "react";
import { orchFetch } from "../../lib/orch-api";

export default function KafeLandingPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    cafeName: "",
    taxId: "",
    zal: true,
    kitchen: false,
    qrMenu: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/v1/public/kafe/onboard", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Signup failed");
        return;
      }
      const pool = data.kafe?.poolBaseUrl as string | undefined;
      const publicOrgNumber = data.kafe?.publicOrgNumber as number | null | undefined;
      if (pool && publicOrgNumber != null) {
        window.location.href = `${pool.replace(/\/$/, "")}/login?org=${publicOrgNumber}`;
        return;
      }
      if (pool) {
        window.location.href = `${pool.replace(/\/$/, "")}/login`;
        return;
      }
      window.location.href = "/workspace";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <p className="text-sm text-[#7F8C8D]">ERA Kafe · 29 AZN</p>
      <h1 className="mb-2 text-2xl font-semibold">Kassa, zal, mətbəx — bir giriş</h1>
      <p className="mb-6 text-sm">
        Owner login is not the cashier PIN. Extra branch +19. QR menu 19 (read-only).
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
        {(["firstName", "lastName", "email", "password", "cafeName", "taxId"] as const).map(
          (k) => (
            <input
              key={k}
              className="rounded border px-3 py-2"
              placeholder={k}
              type={k === "password" ? "password" : "text"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ),
        )}
        <label className="text-sm">
          <input
            type="checkbox"
            checked={form.zal}
            onChange={(e) => setForm({ ...form, zal: e.target.checked })}
          />{" "}
          Zal (5 waiter PINs) +19
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={form.kitchen}
            onChange={(e) => setForm({ ...form, kitchen: e.target.checked })}
          />{" "}
          Kitchen KDS +19
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={form.qrMenu}
            onChange={(e) => setForm({ ...form, qrMenu: e.target.checked })}
          />{" "}
          QR menu +19 (XOR vs Client Portal)
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-[#27AE60] px-3 py-2 text-white"
        >
          {busy ? "…" : "Open café"}
        </button>
      </form>
      <p className="mt-4 text-xs">
        Already have ERA? <Link href="/login">Owner login</Link>
      </p>
    </main>
  );
}
