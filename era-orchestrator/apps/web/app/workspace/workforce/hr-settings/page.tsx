"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

const ROUTE_KINDS = ["FULL_DAY", "HOURLY", "ADVANCE", "VACATION"] as const;
const STEP_KINDS = ["REQUESTER_MANAGER", "ORG_UNIT_HEAD", "POSITION_IN_UNIT"] as const;

type Step = { kind: string; orgUnitId: string; positionId: string };
type Settings = {
  fiveDayWeeklyHours: number | null;
  sixDayWeeklyHours: number | null;
  medicalWeeklyHours: number | null;
  customWeeklyHours: number | null;
  advanceMaxPercent: number | null;
  advanceMaxAmount: number | null;
  advanceMaxOpen: number | null;
  advanceAllowHrProxy: boolean;
};

const EMPTY_SETTINGS: Settings = {
  fiveDayWeeklyHours: null,
  sixDayWeeklyHours: null,
  medicalWeeklyHours: null,
  customWeeklyHours: null,
  advanceMaxPercent: null,
  advanceMaxAmount: null,
  advanceMaxOpen: null,
  advanceAllowHrProxy: false,
};

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function WorkforceHrSettingsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceHrSettings");
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [routes, setRoutes] = useState<Record<string, Step[]>>({
    FULL_DAY: [],
    HOURLY: [],
    ADVANCE: [],
    VACATION: [],
  });
  const [orgUnits, setOrgUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [positions, setPositions] = useState<
    Array<{ id: string; name: string; orgUnitId: string }>
  >([]);

  const load = useCallback(async () => {
    setError(null);
    const [res, unitsRes, posRes] = await Promise.all([
      workforceFetch("hr-settings"),
      workforceFetch("org-units"),
      workforceFetch("positions"),
    ]);
    if (await isWorkforceGate403(res)) {
      setGated(true);
      return;
    }
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const body = (await res.json()) as {
      settings: Settings;
      routes: Array<{ kind: string; steps: Step[] }>;
    };
    setSettings({ ...EMPTY_SETTINGS, ...body.settings });
    const next = { FULL_DAY: [], HOURLY: [], ADVANCE: [], VACATION: [] } as Record<
      string,
      Step[]
    >;
    for (const route of body.routes ?? []) {
      next[route.kind] = (route.steps ?? []).map((step) => ({
        kind: step.kind,
        orgUnitId: step.orgUnitId ?? "",
        positionId: step.positionId ?? "",
      }));
    }
    setRoutes(next);
    if (unitsRes.ok) {
      const units = (await unitsRes.json()) as { items?: Array<{ id: string; name: string }> };
      setOrgUnits(units.items ?? []);
    }
    if (posRes.ok) {
      const pos = (await posRes.json()) as Array<{ id: string; name: string; orgUnitId: string }>;
      setPositions(Array.isArray(pos) ? pos : []);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function saveSettings() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("hr-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRoute(kind: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("hr-settings/routes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          steps: (routes[kind] ?? []).map((step) => ({
            kind: step.kind,
            orgUnitId: step.orgUnitId || undefined,
            positionId: step.positionId || undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate />;

  const hourField = (
    key: Exclude<keyof Settings, "advanceAllowHrProxy">,
    label: string,
  ) => (
    <label className="block text-[13px] font-medium text-[#34495E]">
      {label}
      <input
        className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
        inputMode="decimal"
        value={settings[key] ?? ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, [key]: numOrNull(e.target.value) }))
        }
      />
    </label>
  );

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <section className="mb-8 max-w-3xl space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-4">
        <h2 className="font-semibold text-[#34495E]">{t("hoursTitle")}</h2>
        <p className="text-sm text-[#7F8C8D]">{t("hoursHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {hourField("fiveDayWeeklyHours", t("fiveDay"))}
          {hourField("sixDayWeeklyHours", t("sixDay"))}
          {hourField("medicalWeeklyHours", t("medical"))}
          {hourField("customWeeklyHours", t("custom"))}
        </div>
        <h2 className="pt-2 font-semibold text-[#34495E]">{t("advanceTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {hourField("advanceMaxPercent", t("advancePercent"))}
          {hourField("advanceMaxAmount", t("advanceAmount"))}
          {hourField("advanceMaxOpen", t("advanceOpen"))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
          <input
            type="checkbox"
            checked={settings.advanceAllowHrProxy}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, advanceAllowHrProxy: e.target.checked }))
            }
          />
          {t("advanceProxy")}
        </label>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void saveSettings()}>
          {t("saveSettings")}
        </button>
      </section>

      {ROUTE_KINDS.map((kind) => (
        <section key={kind} className="mb-6 max-w-3xl space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-4">
          <h2 className="font-semibold text-[#34495E]">{t(`kind.${kind}` as "kind.FULL_DAY")}</h2>
          {(routes[kind] ?? []).map((step, index) => (
            <div key={`${kind}-${index}`} className="grid gap-2 border-b border-[#EEF2F6] pb-3 sm:grid-cols-3">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("stepKind")}
                value={step.kind}
                onChange={(next) =>
                  setRoutes((prev) => {
                    const copy = [...(prev[kind] ?? [])];
                    copy[index] = { ...copy[index], kind: String(next) };
                    return { ...prev, [kind]: copy };
                  })
                }
                options={STEP_KINDS.map((value) => ({
                  value,
                  label: t(`step.${value}` as "step.REQUESTER_MANAGER"),
                }))}
              />
              {step.kind !== "REQUESTER_MANAGER" ? (
                <CatalogField
                  kind="ENTITY_REF"
                  label={t("orgUnit")}
                  value={step.orgUnitId}
                  onChange={(next) =>
                    setRoutes((prev) => {
                      const copy = [...(prev[kind] ?? [])];
                      copy[index] = { ...copy[index], orgUnitId: String(next), positionId: "" };
                      return { ...prev, [kind]: copy };
                    })
                  }
                  options={orgUnits.map((unit) => ({ value: unit.id, label: unit.name }))}
                  emptyLabel={t("pick")}
                />
              ) : null}
              {step.kind === "POSITION_IN_UNIT" ? (
                <CatalogField
                  kind="ENTITY_REF"
                  label={t("position")}
                  value={step.positionId}
                  onChange={(next) =>
                    setRoutes((prev) => {
                      const copy = [...(prev[kind] ?? [])];
                      copy[index] = { ...copy[index], positionId: String(next) };
                      return { ...prev, [kind]: copy };
                    })
                  }
                  options={positions
                    .filter((p) => !step.orgUnitId || p.orgUnitId === step.orgUnitId)
                    .map((p) => ({ value: p.id, label: p.name }))}
                  emptyLabel={t("pick")}
                />
              ) : null}
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setRoutes((prev) => ({
                    ...prev,
                    [kind]: (prev[kind] ?? []).filter((_, i) => i !== index),
                  }))
                }
              >
                {t("removeStep")}
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() =>
                setRoutes((prev) => ({
                  ...prev,
                  [kind]: [...(prev[kind] ?? []), { kind: "REQUESTER_MANAGER", orgUnitId: "", positionId: "" }],
                }))
              }
            >
              {t("addStep")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void saveRoute(kind)}>
              {t("saveRoute")}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
