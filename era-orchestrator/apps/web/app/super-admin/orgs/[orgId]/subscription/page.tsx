"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../../lib/auth-context";
import { orchFetch } from "../../../../../lib/orch-api";

type TrialTree = {
  organizationId: string;
  organizationName: string;
  org: {
    isTrial: boolean;
    trialExpiresAt: string | null;
    expiresAt: string | null;
    activeModules: string[];
    quotaOverrides: unknown;
  };
  satellites: Array<{
    satelliteKey: string;
    name: string;
    trialExpiresAt: string | null;
    trialOverridden: boolean;
    connectedAt: string;
    isTrial: boolean;
  }>;
  modules: Array<{
    moduleKey: string;
    trialExpiresAt: string | null;
    trialOverridden: boolean;
    accessUntil: string | null;
  }>;
};

export default function OrgSubscriptionAdminPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const [tree, setTree] = useState<TrialTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/subscription-tree`, {
        token,
      });
      if (!res.ok) {
        setError(`Load failed (${res.status})`);
        setTree(null);
        return;
      }
      setTree((await res.json()) as TrialTree);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function extendOrgMonths(months: number) {
    if (!token || !tree?.org.trialExpiresAt) return;
    const base = new Date(tree.org.trialExpiresAt);
    base.setMonth(base.getMonth() + months);
    await orchFetch(`/v1/admin/organizations/${orgId}/subscription/trial`, {
      token,
      method: "PATCH",
      body: JSON.stringify({ trialExpiresAt: base.toISOString() }),
    });
    await reload();
  }

  async function connectSanatoriumPreset() {
    if (!token) return;
    await orchFetch(`/v1/admin/organizations/${orgId}/connect-preset/sanatorium`, {
      token,
      method: "POST",
    });
    await reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/super-admin/billing" className={GHOST_BUTTON_CLASS}>
          ← Billing
        </Link>
        <Link href={`/super-admin/orgs/${orgId}`} className={GHOST_BUTTON_CLASS}>
          Org hub
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Org subscription trial</h1>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tree ? (
        <>
          <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
            <p className="font-semibold text-[#34495E]">{tree.organizationName}</p>
            <p className="mt-1 text-xs text-[#7F8C8D]">{tree.organizationId}</p>
            <p className="mt-2 text-sm">
              Org trial until:{" "}
              <strong>{tree.org.trialExpiresAt ?? tree.org.expiresAt ?? "—"}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void extendOrgMonths(1)}
              >
                +1 month (org)
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                onClick={() => void connectSanatoriumPreset()}
              >
                Nafta preset (connect bundle)
              </button>
            </div>
          </div>
          <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Satellites</h2>
            <ul className="space-y-2 text-sm">
              {tree.satellites.length === 0 ? (
                <li className="text-[#7F8C8D]">None connected</li>
              ) : (
                tree.satellites.map((s) => (
                  <li key={s.satelliteKey}>
                    <strong>{s.name}</strong> ({s.satelliteKey}) — trial until{" "}
                    {s.trialExpiresAt ?? "—"}
                    {s.trialOverridden ? " · overridden" : ""}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Modules</h2>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {tree.modules.map((m) => (
                <li key={m.moduleKey}>
                  {m.moduleKey} — {m.trialExpiresAt ?? "—"}
                  {m.trialOverridden ? " · overridden" : ""}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
