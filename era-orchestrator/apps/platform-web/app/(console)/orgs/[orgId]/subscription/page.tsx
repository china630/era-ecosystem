"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { bakuDateDisplay, bakuDateKey } from "@era/satellite-kit/time";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import { useOrgShell } from "../org-shell";

type Topology = "SHARED" | "DEDICATED" | "ONPREM";
type Tier = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
type BillingStatus = "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";

type TrialTree = {
  organizationId: string;
  organizationName: string;
  org: {
    isTrial: boolean;
    trialExpiresAt: string | null;
    expiresAt: string | null;
    billingStatus: BillingStatus;
    billingCoveredUntil: string | null;
    isBlocked: boolean;
    currentTier: Tier;
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
  return bakuDateKey(iso);
}

function fromDateInput(value: string): string {
  return `${value}T23:59:59.999Z`;
}

const TOPOLOGY_OPTIONS = [
  { value: "SHARED", labelKey: "topologyShared" as const },
  { value: "DEDICATED", labelKey: "topologyDedicated" as const },
  { value: "ONPREM", labelKey: "topologyOnprem" as const },
];

const TIER_OPTIONS = [
  { value: "TIER_0", label: "TIER_0" },
  { value: "TIER_1", label: "TIER_1" },
  { value: "TIER_2", label: "TIER_2" },
  { value: "TIER_3", label: "TIER_3" },
];

export default function OrgSubscriptionAdminPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const { reloadHeader } = useOrgShell();
  const t = useTranslations("superAdmin.orgLicense");
  const tc = useTranslations("superAdmin.orgBillingCoverage");
  const tCommon = useTranslations("common");
  const [tree, setTree] = useState<TrialTree | null>(null);
  const [coverageDate, setCoverageDate] = useState("");
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
  const [quotasOpen, setQuotasOpen] = useState(false);
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
        setError(t("loadFailed", { status: res.status }));
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
      setIsBlocked(Boolean(next.org.isBlocked));
      if (next.org.currentTier) setTier(next.org.currentTier);
      setCoverageDate(toDateInput(next.org.billingCoveredUntil));
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
  }, [token, orgId, t]);

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
        setError(t("saveFailed", { status: res.status }));
        return;
      }
      await reload();
      await reloadHeader();
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
        setError(t("subscriptionPatchFailed", { status: res.status }));
        return;
      }
      await reload();
      await reloadHeader();
    } finally {
      setSaving(false);
    }
  }

  async function saveCoverage(coveredUntil: string | null) {
    if (!token) return;
    if (coveredUntil !== null && !coveredUntil) {
      setError(tc("dateRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/billing-coverage`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ coveredUntil }),
      });
      if (!res.ok) {
        setError(tc("saveFailed", { status: res.status }));
        return;
      }
      await reload();
      await reloadHeader();
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
        setError(t("topologySaveFailed", { status: res.status }));
        return;
      }
      await reload();
      await reloadHeader();
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
      setError(t("dateOrPerpetual"));
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
          setError(t("quotaJsonInvalid"));
          return;
        }
      }
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/quotas`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ quotaOverrides }),
      });
      if (!res.ok) {
        setError(t("quotaSaveFailed", { status: res.status }));
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
        setError(t("satTrialSaveFailed", { status: res.status }));
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
        setError(t("modTrialSaveFailed", { status: res.status }));
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const expiryIso = tree?.org.trialExpiresAt ?? tree?.org.expiresAt ?? null;
  const untilLabel = neverExpires
    ? t("perpetualLabel")
    : expiryIso
      ? bakuDateDisplay(expiryIso)
      : "—";

  return (
    <div className="space-y-4">
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tree ? (
        <>
          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t("summaryTitle")}</h2>
            <p className="text-sm text-[#34495E]">
              {t("accessUntil")}: <strong>{untilLabel}</strong>
              {tree.org.isTrial ? ` · ${t("trial")}` : ` · ${t("paid")}`}
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => {
                  const on = e.target.checked;
                  setNeverExpires(on);
                  if (on) setIsTrial(false);
                }}
              />
              {t("perpetual")}
            </label>
            <label className="flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={isTrial}
                disabled={neverExpires}
                onChange={(e) => setIsTrial(e.target.checked)}
              />
              {t("markTrial")}
            </label>
            <DatePicker
              label={t("licenseEnd")}
              value={dateValue}
              onChange={setDateValue}
              placeholder={tCommon("datePlaceholder")}
              disabled={neverExpires}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void saveLicense()}
              >
                {t("saveLicense")}
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void patchTrial({ shiftMonths: 1 })}
              >
                {t("plusMonth")}
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void patchTrial({ shiftMonths: -1 })}
              >
                {t("minusMonth")}
              </button>
            </div>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t("topologyTitle")}</h2>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("topologyLabel")}
              value={topology}
              onChange={(next) => setTopology(next as Topology)}
              options={TOPOLOGY_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.labelKey),
              }))}
            />
            <label className="flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={applyDefault}
                onChange={(e) => setApplyDefault(e.target.checked)}
              />
              {t("applyTopologyDefault")}
            </label>
            <p className="text-xs text-[#95A5A6]">{t("topologyHint")}</p>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              disabled={saving}
              onClick={() => void saveTopology()}
            >
              {t("saveTopology")}
            </button>
          </section>

          <section
            className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
            data-testid="billing-coverage"
          >
            <h2 className="text-sm font-semibold text-[#34495E]">{tc("title")}</h2>
            <p className="text-sm text-[#34495E]">
              {tc("status")}:{" "}
              <strong
                className={
                  tree.org.billingStatus === "ACTIVE"
                    ? "text-emerald-700"
                    : tree.org.billingStatus === "SOFT_BLOCK"
                      ? "text-amber-700"
                      : "text-red-700"
                }
              >
                {tc(`status${tree.org.billingStatus}`)}
              </strong>
            </p>
            <p className="text-sm text-[#34495E]">
              {tc("coveredUntil")}:{" "}
              <strong>
                {tree.org.billingCoveredUntil
                  ? bakuDateDisplay(tree.org.billingCoveredUntil)
                  : tc("notCovered")}
              </strong>
            </p>
            <p className="text-xs text-[#95A5A6]">{tc("hint")}</p>
            <DatePicker
              label={tc("dateLabel")}
              value={coverageDate}
              onChange={setCoverageDate}
              placeholder={tCommon("datePlaceholder")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void saveCoverage(coverageDate)}
              >
                {tc("save")}
              </button>
              {tree.org.billingCoveredUntil ? (
                <button
                  type="button"
                  className={GHOST_BUTTON_CLASS}
                  disabled={saving}
                  onClick={() => void saveCoverage(null)}
                >
                  {tc("clear")}
                </button>
              ) : null}
            </div>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t("blockTierTitle")}</h2>
            <label className="flex items-center gap-2 text-sm text-[#34495E]">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
              />
              {t("blockAccess")}
            </label>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("tierLabel")}
              value={tier}
              onChange={(next) => setTier(next as Tier)}
              options={TIER_OPTIONS}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={saving}
              onClick={() => void patchSubscription({ isBlocked, tier, isTrial })}
            >
              {t("saveBlockTier")}
            </button>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <button
              type="button"
              className="text-sm font-semibold text-[#2980B9]"
              onClick={() => setQuotasOpen((v) => !v)}
            >
              {quotasOpen ? t("quotasHide") : t("quotasShow")}
            </button>
            {quotasOpen ? (
              <>
                <p className="text-xs text-[#95A5A6]">{t("quotasHint")}</p>
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
                  {t("saveQuotas")}
                </button>
              </>
            ) : null}
          </section>

          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t("presetTitle")}</h2>
            <p className="text-xs text-[#95A5A6]">{t("presetHint")}</p>
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
              {t("naftaPreset")}
            </button>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("satellitesTitle")}</h2>
            <ul className="space-y-3 text-sm">
              {tree.satellites.length === 0 ? (
                <li className="text-[#7F8C8D]">{t("satellitesEmpty")}</li>
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
                        <span className="text-xs text-amber-700">{t("overridden")}</span>
                      ) : null}
                    </div>
                    <DatePicker
                      label={s.satelliteKey}
                      value={satDates[s.satelliteKey] ?? ""}
                      onChange={(iso) =>
                        setSatDates((prev) => ({
                          ...prev,
                          [s.satelliteKey]: iso,
                        }))
                      }
                      placeholder={tCommon("datePlaceholder")}
                    />
                    <button
                      type="button"
                      className={GHOST_BUTTON_CLASS}
                      disabled={saving}
                      onClick={() => void saveSatelliteTrial(s.satelliteKey)}
                    >
                      {t("save")}
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
                      {t("perpetual")}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("modulesTitle")}</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
              {tree.modules.map((m) => (
                <li
                  key={m.moduleKey}
                  className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-1"
                >
                  <span className="min-w-[10rem] font-mono">{m.moduleKey}</span>
                  {m.trialOverridden ? (
                    <span className="text-amber-700">{t("overridden")}</span>
                  ) : null}
                  <DatePicker
                    label={m.moduleKey}
                    value={modDates[m.moduleKey] ?? ""}
                    onChange={(iso) =>
                      setModDates((prev) => ({
                        ...prev,
                        [m.moduleKey]: iso,
                      }))
                    }
                    placeholder={tCommon("datePlaceholder")}
                  />
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    disabled={saving}
                    onClick={() => void saveModuleTrial(m.moduleKey)}
                  >
                    {t("save")}
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
