"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Holder = {
  id: string;
  displayName: string;
  ceilingAzn: number;
  usedAzn: number;
  availableAzn: number;
  active: boolean;
};

export default function LimitHoldersPage() {
  const t = useTranslations("hallPages");
  const nav = useTranslations("nav");
  const [rows, setRows] = useState<Holder[]>([]);
  const [name, setName] = useState("");
  const [ceiling, setCeiling] = useState("100");
  const [error, setError] = useState("");

  async function reload() {
    const res = await fetch("/api/admin/limit-holders");
    if (!res.ok) {
      setError(t("unavailable"));
      return;
    }
    setRows(await res.json());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/limit-holders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name, ceilingAzn: Number(ceiling) }),
    });
    if (!res.ok) {
      setError(t("createFailed"));
      return;
    }
    setName("");
    await reload();
  }

  async function settle(id: string, used: number) {
    const raw = window.prompt(t("settle"), String(used));
    if (!raw) return;
    const res = await fetch(`/api/admin/limit-holders/${id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(raw) }),
    });
    if (!res.ok) {
      setError(t("rejected"));
      return;
    }
    await reload();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{nav("limits")}</h1>
      <p className="text-sm text-neutral-600">{t("hint")}</p>
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1" placeholder={t("name")} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-28 rounded border px-2 py-1" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
        <button className="rounded border px-3 py-1" type="submit">{t("add")}</button>
      </form>
      {error ? <p className="text-sm">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
            <span>
              {row.displayName} · used {row.usedAzn.toFixed(2)} / {row.ceilingAzn.toFixed(2)} · left {row.availableAzn.toFixed(2)}
            </span>
            <button type="button" className="rounded border px-2 py-1" onClick={() => void settle(row.id, row.usedAzn)}>
              {t("settle")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
