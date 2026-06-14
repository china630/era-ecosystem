"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../lib/auth-context";
import { orchFetch } from "../../../../lib/orch-api";

type AllowlistRow = {
  key: string;
  name: string;
  satelliteKey: string | null;
  trialEligibleInTrial: boolean;
};

export default function TrialAllowlistPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await orchFetch("/v1/admin/config/trial-allowlist", { token });
      if (!res.ok) return;
      const data = (await res.json()) as AllowlistRow[];
      setRows(data);
      setSelected(new Set(data.filter((r) => r.trialEligibleInTrial).map((r) => r.key)));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      await orchFetch("/v1/admin/config/trial-allowlist", {
        token,
        method: "PATCH",
        body: JSON.stringify({ moduleKeys: [...selected] }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const grouped = rows.reduce<Record<string, AllowlistRow[]>>((acc, row) => {
    const g = row.satelliteKey ?? "platform";
    (acc[g] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/super-admin/billing" className={GHOST_BUTTON_CLASS}>
          ← Billing
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Platform trial allowlist</h1>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {!loading ? (
        <>
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group} className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
              <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{group}</h2>
              <ul className="space-y-1 text-sm">
                {items.map((row) => (
                  <li key={row.key}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.key)}
                        onChange={() => toggle(row.key)}
                      />
                      <span>
                        {row.name} <span className="text-[#7F8C8D]">({row.key})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save allowlist"}
          </button>
        </>
      ) : null}
    </div>
  );
}
