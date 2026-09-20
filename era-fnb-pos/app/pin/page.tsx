"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStaffLoginOrgNo, persistLoginOrgNo } from "@era/satellite-kit/ui";

function PinForm() {
  const search = useSearchParams();
  const [pin, setPin] = useState("");
  const { orgNo, setOrgNo, hostBound } = useStaffLoginOrgNo(search);
  const [outletId, setOutletId] = useState(search.get("outletId") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = orgNo.trim();
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          orgNo: org || undefined,
          outletId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (body?.error === "PIN_OUTLET_UNBOUND") {
          setError("PIN not bound to an outlet — ask the owner");
        } else {
          setError("Invalid PIN");
        }
        return;
      }
      if (org) persistLoginOrgNo(org);
      window.location.href = "/floor";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">ERA Kafe PIN</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
        {hostBound ? null : (
          <input
            className="rounded border px-3 py-2 font-mono"
            placeholder="Organization code (6 digits)"
            value={orgNo}
            onChange={(e) => setOrgNo(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
          />
        )}
        <input
          className="rounded border px-3 py-2"
          placeholder="Outlet ID"
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 tracking-[0.4em]"
          placeholder="PIN"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-[#27AE60] px-3 py-2 text-white"
        >
          {busy ? "…" : "Open till"}
        </button>
      </form>
    </main>
  );
}

export default function PinPage() {
  return (
    <Suspense>
      <PinForm />
    </Suspense>
  );
}
