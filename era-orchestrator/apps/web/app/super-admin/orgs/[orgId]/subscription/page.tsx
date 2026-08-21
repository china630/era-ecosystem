"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../../lib/auth-context";
import { orchFetch } from "../../../../../lib/orch-api";

type Topology = "SHARED" | "DEDICATED" | "ONPREM";
type Tier = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";

type TrialTree = {
  organizationId: string;
  organizationName: string;
  org: {
    isTrial: boolean;
    trialExpiresAt: string | null;
    expiresAt: string | null;
    deploymentTopology: Topology;
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

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string {
  return `${value}T23:59:59.999Z`;
}

export default function OrgSubscriptionAdminPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const [tree, setTree] = useState<TrialTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topology, setTopology] = useState<Topology>("SHARED");
  const [applyDefault, setApplyDefault] = useState(false);
  const [neverExpires, setNeverExpires] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [isTrial, setIsTrial] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [tier, setTier] = useState<Tier>("TIER_0");
  const [quotaJson, setQuotaJson] = useState("");
  const [satDates, setSatDates] = useState<Record<string, string>>({});
  const [modDates, setModDates] = useState<Record<string, string>>({});

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
      const next = (await res.json()) as TrialTree;
      setTree(next);
      setTopology(next.org.deploymentTopology ?? "SHARED");
      const perpetual = !next.org.trialExpiresAt && !next.org.expiresAt;
      setNeverExpires(perpetual);
      setDateValue(toDateInput(next.org.trialExpiresAt ?? next.org.expiresAt));
      setIsTrial(next.org.isTrial);
      setApplyDefault(false);
      setQuotaJson(
        next.org.quotaOverrides
          ? JSON.stringify(next.org.quotaOverrides, null, 2)
          : "",
      );
      const nextSat: Record<string, string> = {};
      for (const s of next.satellites) {
        nextSat[s.satelliteKey] = toDateInput(s.trialExpiresAt);
      }
      setSatDates(nextSat);
      const nextMod: Record<string, string> = {};
      for (const m of next.modules) {
        nextMod[m.moduleKey] = toDateInput(m.trialExpiresAt);
      }
      setModDates(nextMod);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function patchTrial(body: Record<string, unknown>) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/subscription/trial`, {
        token,
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function patchSubscription(body: Record<string, unknown>) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/subscription`, {
        token,
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`Subscription patch failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveTopology() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/deployment-topology`, {
        token,
        method: "PATCH",
        body: JSON.stringify({
          topology,
          applyLicenseDefault: applyDefault,
        }),
      });
      if (!res.ok) {
        setError(`Topology save failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveLicense() {
    if (neverExpires) {
      await patchTrial({ neverExpires: true, isTrial: false });
      return;
    }
    if (!dateValue) {
      setError("Set an end date or check perpetual.");
      return;
    }
    await patchTrial({
      trialExpiresAt: fromDateInput(dateValue),
      isTrial,
    });
  }

  async function saveQuotas() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      let quotaOverrides: Record<string, unknown> | null = null;
      if (quotaJson.trim()) {
        try {
          quotaOverrides = JSON.parse(quotaJson) as Record<string, unknown>;
        } catch {
          setError("Quota overrides must be valid JSON.");
          return;
        }
      }
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/quotas`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ quotaOverrides }),
      });
      if (!res.ok) {
        setError(`Quota save failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveSatelliteTrial(satelliteKey: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const raw = satDates[satelliteKey] ?? "";
      const body = {
        trialExpiresAt: raw ? fromDateInput(raw) : null,
      };
      const res = await orchFetch(
        `/v1/admin/organizations/${orgId}/satellites/${encodeURIComponent(satelliteKey)}/trial`,
        { token, method: "PATCH", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        setError(`Satellite trial save failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveModuleTrial(moduleKey: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const raw = modDates[moduleKey] ?? "";
      const body = {
        trialExpiresAt: raw ? fromDateInput(raw) : null,
      };
      const res = await orchFetch(
        `/v1/admin/organizations/${orgId}/modules/${encodeURIComponent(moduleKey)}/trial`,
        { token, method: "PATCH", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        setError(`Module trial save failed (${res.status})`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const untilLabel = neverExpires
    ? "Perpetual (no expiry)"
    : (tree?.org.trialExpiresAt ?? tree?.org.expiresAt ?? "—");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/super-admin/orgs" className={GHOST_BUTTON_CLASS}>
          ← Organizations
        </Link>
        <Link href={`/super-admin/orgs/${orgId}`} className={GHOST_BUTTON_CLASS}>
          Org hub
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Org license / trial</h1>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tree ? (
        <>
          <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
            <p className="font-semibold text-[#34495E]">{tree.organizationName}</p>
            <p className="mt-1 text-xs text-[#7F8C8D]">{tree.organizationId}</p>
            <p className="mt-2 text-sm">
              Access until: <strong>{untilLabel}</strong>
              {tree.org.isTrial ? " · trial" : " · paid / contract"}
            </p>

            <label className="mt-4 block text-xs font-medium text-[#7F8C8D]">
              Deployment topology
            </label>
            <select
              className={`${MODAL_INPUT_CLASS} mt-1 max-w-xs`}
              value={topology}
              onChange={(e) => setTopology(e.target.value as Topology)}
            >
              <option value="SHARED">SHARED — system trial default</option>
              <option value="DEDICATED">DEDICATED — no trial default</option>
              <option value="ONPREM">ONPREM — perpetual default</option>
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={applyDefault}
                onChange={(e) => setApplyDefault(e.target.checked)}
              />
              Apply topology license default (rewrites dates)
            </label>
            <p className="mt-1 text-xs text-[#95A5A6]">
              ONPREM dates apply when the control plane is reachable (cloud orch +
              tunnel). Air-gap is contractual / offline lease — not a remote kill switch.
            </p>
            <button
              type="button"
              className={`${GHOST_BUTTON_CLASS} mt-2`}
              disabled={saving}
              onClick={() => void saveTopology()}
            >
              Save topology
            </button>

            <label className="mt-6 flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => {
                  const on = e.target.checked;
                  setNeverExpires(on);
                  if (on) setIsTrial(false);
                }}
              />
              Perpetual — no expiry
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={isTrial}
                disabled={neverExpires}
                onChange={(e) => setIsTrial(e.target.checked)}
              />
              Mark as trial
            </label>
            <label className="mt-3 block text-xs font-medium text-[#7F8C8D]">
              License / trial end
            </label>
            <input
              type="date"
              className={`${MODAL_INPUT_CLASS} mt-1 max-w-xs`}
              disabled={neverExpires}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void saveLicense()}
              >
                Save license
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void patchTrial({ shiftMonths: 1 })}
              >
                +1 month
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void patchTrial({ shiftMonths: -1 })}
              >
                −1 month
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={saving}
                onClick={() =>
                  void orchFetch(
                    `/v1/admin/organizations/${orgId}/connect-preset/sanatorium`,
                    { token: token!, method: "POST" },
                  ).then(() => reload())
                }
              >
                Nafta preset (connect bundle)
              </button>
            </div>
          </div>

          <section className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
            <h2 className="text-sm font-semibold">Block / tier</h2>
            <label className="flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
              />
              Block subscription access
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              Current tier
            </label>
            <select
              className={`${MODAL_INPUT_CLASS} max-w-xs`}
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
            >
              <option value="TIER_0">TIER_0</option>
              <option value="TIER_1">TIER_1</option>
              <option value="TIER_2">TIER_2</option>
              <option value="TIER_3">TIER_3</option>
            </select>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={saving}
              onClick={() => void patchSubscription({ isBlocked, tier, isTrial })}
            >
              Save block / tier
            </button>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
            <h2 className="text-sm font-semibold">Quota overrides (JSON)</h2>
            <textarea
              className={`${MODAL_INPUT_CLASS} min-h-[8rem] font-mono text-xs`}
              value={quotaJson}
              onChange={(e) => setQuotaJson(e.target.value)}
              placeholder='{"employees": 50}'
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={saving}
              onClick={() => void saveQuotas()}
            >
              Save quotas
            </button>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Satellites</h2>
            <ul className="space-y-3 text-sm">
              {tree.satellites.length === 0 ? (
                <li className="text-[#7F8C8D]">None connected</li>
              ) : (
                tree.satellites.map((s) => (
                  <li
                    key={s.satelliteKey}
                    className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] pb-2"
                  >
                    <div className="min-w-[12rem]">
                      <strong>{s.name}</strong>
                      <div className="text-xs text-[#7F8C8D]">{s.satelliteKey}</div>
                      {s.trialOverridden ? (
                        <span className="text-xs text-amber-700">overridden</span>
                      ) : null}
                    </div>
                    <input
                      type="date"
                      className={`${MODAL_INPUT_CLASS} max-w-[11rem]`}
                      value={satDates[s.satelliteKey] ?? ""}
                      onChange={(e) =>
                        setSatDates((prev) => ({
                          ...prev,
                          [s.satelliteKey]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className={GHOST_BUTTON_CLASS}
                      disabled={saving}
                      onClick={() => void saveSatelliteTrial(s.satelliteKey)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={GHOST_BUTTON_CLASS}
                      disabled={saving}
                      onClick={() => {
                        setSatDates((prev) => ({ ...prev, [s.satelliteKey]: "" }));
                        void (async () => {
                          setSaving(true);
                          try {
                            await orchFetch(
                              `/v1/admin/organizations/${orgId}/satellites/${encodeURIComponent(s.satelliteKey)}/trial`,
                              {
                                token: token!,
                                method: "PATCH",
                                body: JSON.stringify({ trialExpiresAt: null }),
                              },
                            );
                            await reload();
                          } finally {
                            setSaving(false);
                          }
                        })();
                      }}
                    >
                      Perpetual
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Modules</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
              {tree.modules.map((m) => (
                <li
                  key={m.moduleKey}
                  className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-1"
                >
                  <span className="min-w-[10rem] font-mono">{m.moduleKey}</span>
                  {m.trialOverridden ? (
                    <span className="text-amber-700">overridden</span>
                  ) : null}
                  <input
                    type="date"
                    className={`${MODAL_INPUT_CLASS} max-w-[11rem]`}
                    value={modDates[m.moduleKey] ?? ""}
                    onChange={(e) =>
                      setModDates((prev) => ({
                        ...prev,
                        [m.moduleKey]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    disabled={saving}
                    onClick={() => void saveModuleTrial(m.moduleKey)}
                  >
                    Save
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
