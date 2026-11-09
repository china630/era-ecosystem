"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { bakuDateKey } from "@era/satellite-kit/time";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  GHOST_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";

type TrialTree = {
  satellites: Array<{
    satelliteKey: string;
    name: string;
    trialExpiresAt: string | null;
    trialOverridden: boolean;
  }>;
  modules: Array<{
    moduleKey: string;
    trialExpiresAt: string | null;
    trialOverridden: boolean;
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

export default function OrgModulesPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgLicense");
  const tCommon = useTranslations("common");
  const [tree, setTree] = useState<TrialTree | null>(null);
  const [satDates, setSatDates] = useState<Record<string, string>>({});
  const [modDates, setModDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/subscription-tree`, { token });
      if (!res.ok) {
        setError(t("loadFailed", { status: res.status }));
        return;
      }
      const next = (await res.json()) as TrialTree;
      setTree(next);
      const nextSat: Record<string, string> = {};
      for (const s of next.satellites) nextSat[s.satelliteKey] = toDateInput(s.trialExpiresAt);
      setSatDates(nextSat);
      const nextMod: Record<string, string> = {};
      for (const m of next.modules) nextMod[m.moduleKey] = toDateInput(m.trialExpiresAt);
      setModDates(nextMod);
    } finally {
      setLoading(false);
    }
  }, [token, orgId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveSatellite(satelliteKey: string, raw: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/v1/admin/organizations/${orgId}/satellites/${encodeURIComponent(satelliteKey)}/trial`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify({ trialExpiresAt: raw ? fromDateInput(raw) : null }),
        },
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

  async function saveModule(moduleKey: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const raw = modDates[moduleKey] ?? "";
      const res = await orchFetch(
        `/v1/admin/organizations/${orgId}/modules/${encodeURIComponent(moduleKey)}/trial`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify({ trialExpiresAt: raw ? fromDateInput(raw) : null }),
        },
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

  return (
    <div className="space-y-4">
      <PageHeader title={t("modulesPageTitle")} subtitle={t("modulesPageHint")} />
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tree ? (
        <>
          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("satellitesTitle")}</h2>
            <ul className="space-y-3 text-sm">
              {tree.satellites.length === 0 ? (
                <li className="text-[#7F8C8D]">{t("satellitesEmpty")}</li>
              ) : (
                tree.satellites.map((s) => (
                  <li key={s.satelliteKey} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] pb-2">
                    <div className="min-w-[12rem]">
                      <strong>{s.name}</strong>
                      {s.trialOverridden ? (
                        <div className="text-xs text-amber-700">{t("overridden")}</div>
                      ) : null}
                    </div>
                    <DatePicker
                      label={s.name}
                      value={satDates[s.satelliteKey] ?? ""}
                      onChange={(iso) => setSatDates((prev) => ({ ...prev, [s.satelliteKey]: iso }))}
                      placeholder={tCommon("datePlaceholder")}
                    />
                    <button
                      type="button"
                      className={GHOST_BUTTON_CLASS}
                      disabled={saving}
                      onClick={() => void saveSatellite(s.satelliteKey, satDates[s.satelliteKey] ?? "")}
                    >
                      {t("save")}
                    </button>
                    <button
                      type="button"
                      className={GHOST_BUTTON_CLASS}
                      disabled={saving}
                      onClick={() => void saveSatellite(s.satelliteKey, "")}
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
                <li key={m.moduleKey} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-1">
                  <span className="min-w-[10rem] font-mono">{m.moduleKey}</span>
                  {m.trialOverridden ? <span className="text-amber-700">{t("overridden")}</span> : null}
                  <DatePicker
                    label={m.moduleKey}
                    value={modDates[m.moduleKey] ?? ""}
                    onChange={(iso) => setModDates((prev) => ({ ...prev, [m.moduleKey]: iso }))}
                    placeholder={tCommon("datePlaceholder")}
                  />
                  <button
                    type="button"
                    className={GHOST_BUTTON_CLASS}
                    disabled={saving}
                    onClick={() => void saveModule(m.moduleKey)}
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
