"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../lib/auth-context";
import { orchFetch } from "../../../../lib/orch-api";

type OperatingMode = {
  organizationId: string;
  mode: "STANDALONE" | "DEPARTMENT";
  parentOrgId: string | null;
  fiscalRouting: "OWN" | "PARENT";
  revenueRouting: "OWN" | "PARENT";
};

type SatelliteEndpoint = {
  satelliteKey: string;
  baseUrl: string;
  enabled: boolean;
};

type DepartmentRow = {
  id: string;
  name: string;
  operatingMode: string;
  parentOrgId: string | null;
  createdAt: string;
};

type VendorBridgeBundle = {
  organizationId: string;
  industries: string[];
  elektrawebBridge: {
    inboundEnabled: boolean;
    writeEnabled: boolean;
    elektrawebHotelId: number | null;
    spaDepId: number | null;
    spaCurrencyId: number | null;
    walkinResId: string | null;
    walkinResNameId: string | null;
  } | null;
  clinicCutover: {
    elektrawebDualRun: boolean;
    hotelOrganizationId: string | null;
  } | null;
};

type BridgeDraft = {
  inboundEnabled: boolean;
  writeEnabled: boolean;
  elektrawebHotelId: string;
  spaDepId: string;
  spaCurrencyId: string;
  walkinResId: string;
  walkinResNameId: string;
};

type CutoverDraft = {
  elektrawebDualRun: boolean;
  hotelOrganizationId: string;
};

const ENDPOINT_PRESETS = [
  "industry_hotel_pms",
  "industry_fnb_pos",
  "industry_clinic",
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_wholesale",
  "finance_core",
];

const EMPTY_BRIDGE: BridgeDraft = {
  inboundEnabled: false,
  writeEnabled: false,
  elektrawebHotelId: "",
  spaDepId: "",
  spaCurrencyId: "",
  walkinResId: "",
  walkinResNameId: "",
};

const EMPTY_CUTOVER: CutoverDraft = {
  elektrawebDualRun: false,
  hotelOrganizationId: "",
};

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

type FieldNotice = { kind: "ok" | "err"; text: string };

async function noticeFromFailedResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
    if (Array.isArray(body.message) && body.message[0]) return String(body.message[0]);
  } catch {
    /* ignore non-JSON */
  }
  return "";
}

export default function SuperAdminOrgHubPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [mode, setMode] = useState<OperatingMode | null>(null);
  const [endpoints, setEndpoints] = useState<SatelliteEndpoint[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptName, setDeptName] = useState("");
  const [endpointDraft, setEndpointDraft] = useState<Record<string, { baseUrl: string; enabled: boolean }>>({});
  const [parentOrgId, setParentOrgId] = useState("");
  const [bridgeDraft, setBridgeDraft] = useState<BridgeDraft>(EMPTY_BRIDGE);
  const [cutoverDraft, setCutoverDraft] = useState<CutoverDraft>(EMPTY_CUTOVER);
  const [industries, setIndustries] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [bridgeNotice, setBridgeNotice] = useState<FieldNotice | null>(null);
  const [cutoverNotice, setCutoverNotice] = useState<FieldNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingBridge, setSavingBridge] = useState(false);
  const [savingCutover, setSavingCutover] = useState(false);

  const showHotelBridge =
    industries.includes("hotel") ||
    endpoints.some((e) => e.satelliteKey === "industry_hotel_pms" && e.enabled) ||
    Boolean(endpointDraft.industry_hotel_pms?.enabled && endpointDraft.industry_hotel_pms?.baseUrl.trim());
  const showClinicCutover =
    industries.includes("clinic") ||
    endpoints.some((e) => e.satelliteKey === "industry_clinic" && e.enabled) ||
    Boolean(endpointDraft.industry_clinic?.enabled && endpointDraft.industry_clinic?.baseUrl.trim()) ||
    mode?.mode === "DEPARTMENT";

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, epRes, deptRes, bridgeRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/departments`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/elektraweb-bridge`, { token }),
      ]);
      if (modeRes.ok) setMode((await modeRes.json()) as OperatingMode);
      if (epRes.ok) {
        const eps = (await epRes.json()) as SatelliteEndpoint[];
        setEndpoints(eps);
        const draft: Record<string, { baseUrl: string; enabled: boolean }> = {};
        for (const key of ENDPOINT_PRESETS) {
          const row = eps.find((e) => e.satelliteKey === key);
          draft[key] = { baseUrl: row?.baseUrl ?? "", enabled: row?.enabled ?? false };
        }
        setEndpointDraft(draft);
      }
      if (deptRes.ok) setDepartments((await deptRes.json()) as DepartmentRow[]);
      if (bridgeRes.ok) {
        const bundle = (await bridgeRes.json()) as VendorBridgeBundle;
        setIndustries(bundle.industries ?? []);
        const b = bundle.elektrawebBridge;
        setBridgeDraft(
          b
            ? {
                inboundEnabled: b.inboundEnabled,
                writeEnabled: b.writeEnabled,
                elektrawebHotelId: b.elektrawebHotelId != null ? String(b.elektrawebHotelId) : "",
                spaDepId: b.spaDepId != null ? String(b.spaDepId) : "",
                spaCurrencyId: b.spaCurrencyId != null ? String(b.spaCurrencyId) : "",
                walkinResId: b.walkinResId ?? "",
                walkinResNameId: b.walkinResNameId ?? "",
              }
            : EMPTY_BRIDGE,
        );
        const c = bundle.clinicCutover;
        setCutoverDraft(
          c
            ? {
                elektrawebDualRun: c.elektrawebDualRun,
                hotelOrganizationId: c.hotelOrganizationId ?? "",
              }
            : EMPTY_CUTOVER,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveOperatingMode(nextMode: "STANDALONE" | "DEPARTMENT") {
    if (!token) return;
    setMessage("");
    const body =
      nextMode === "DEPARTMENT"
        ? {
            mode: "DEPARTMENT",
            parentOrgId: parentOrgId.trim() || mode?.parentOrgId,
            fiscalRouting: "PARENT",
            revenueRouting: "PARENT",
          }
        : { mode: "STANDALONE" };
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, {
      token,
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage(t("operatingModeSaveFailed", { status: res.status }));
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setMessage(t("operatingModeSaved"));
    await reload();
  }

  async function saveEndpoint(key: string) {
    if (!token) return;
    const row = endpointDraft[key];
    if (!row?.baseUrl.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints/${key}`, {
      token,
      method: "PUT",
      body: JSON.stringify({
        satelliteKey: key,
        baseUrl: row.baseUrl.trim(),
        enabled: row.enabled,
      }),
    });
    if (!res.ok) {
      setMessage(t("endpointSaveFailed", { key, status: res.status }));
      return;
    }
    setMessage(t("endpointSaved", { key }));
    await reload();
  }

  async function createDepartment() {
    if (!token || !deptName.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/departments`, {
      token,
      method: "POST",
      body: JSON.stringify({ name: deptName.trim() }),
    });
    if (!res.ok) {
      setMessage(t("createDepartmentFailed", { status: res.status }));
      return;
    }
    setDeptName("");
    setMessage(t("departmentCreated"));
    await reload();
  }

  async function detachDepartment() {
    if (!token) return;
    if (!window.confirm(t("detachConfirm"))) {
      return;
    }
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode/detach`, {
      token,
      method: "POST",
    });
    if (!res.ok) {
      setMessage(t("detachFailed", { status: res.status }));
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setMessage(t("detached"));
    await reload();
  }

  function copyUuid(id: string) {
    void navigator.clipboard.writeText(id);
    setMessage(t("copied", { id }));
  }

  async function saveElektrawebBridge() {
    if (!token) return;
    setSavingBridge(true);
    setBridgeNotice(null);
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/elektraweb-bridge`, {
        token,
        method: "PUT",
        body: JSON.stringify({
          inboundEnabled: bridgeDraft.inboundEnabled,
          writeEnabled: bridgeDraft.writeEnabled,
          elektrawebHotelId: parseOptionalInt(bridgeDraft.elektrawebHotelId),
          spaDepId: parseOptionalInt(bridgeDraft.spaDepId),
          spaCurrencyId: parseOptionalInt(bridgeDraft.spaCurrencyId),
          walkinResId: bridgeDraft.walkinResId.trim() || null,
          walkinResNameId: bridgeDraft.walkinResNameId.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = await noticeFromFailedResponse(res);
        setBridgeNotice({
          kind: "err",
          text: t("bridgeSaveFailed", {
            status: res.status,
            detail: detail ? `: ${detail}` : "",
          }),
        });
        return;
      }
      setBridgeNotice({ kind: "ok", text: t("bridgeSaved") });
      await reload();
    } finally {
      setSavingBridge(false);
    }
  }

  async function saveClinicCutover() {
    if (!token) return;
    setSavingCutover(true);
    setCutoverNotice(null);
    try {
      const hotelId = cutoverDraft.hotelOrganizationId.trim();
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/clinic-cutover`, {
        token,
        method: "PUT",
        body: JSON.stringify({
          elektrawebDualRun: cutoverDraft.elektrawebDualRun,
          hotelOrganizationId: hotelId || null,
        }),
      });
      if (!res.ok) {
        const detail = await noticeFromFailedResponse(res);
        setCutoverNotice({
          kind: "err",
          text: t("cutoverSaveFailed", {
            status: res.status,
            detail: detail ? `: ${detail}` : "",
          }),
        });
        return;
      }
      setCutoverNotice({ kind: "ok", text: t("cutoverSaved") });
      await reload();
    } finally {
      setSavingCutover(false);
    }
  }

  async function syncSatelliteBindings() {
    if (!token || !orgId) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/sync-satellite-bindings`, {
        token,
        method: "POST",
      });
      if (!res.ok) {
        setMessage(t("syncFailed", { status: res.status }));
        return;
      }
      const body = (await res.json()) as {
        results?: Array<{ satelliteKey: string; ok: boolean; organizationId: string; error?: string }>;
      };
      const results = body.results ?? [];
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      if (results.length === 0) {
        setMessage(t("syncEmpty"));
        return;
      }
      if (fail.length === 0) {
        setMessage(t("syncOk", { count: ok }));
        return;
      }
      setMessage(
        t("syncPartial", {
          ok,
          total: results.length,
          failed: fail
            .map((f) => `${f.satelliteKey}${f.error ? ` (${f.error.slice(0, 80)})` : ""}`)
            .join("; "),
        }),
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/super-admin/orgs" className={GHOST_BUTTON_CLASS}>
          {t("backOrgs")}
        </Link>
        <Link href={`/super-admin/orgs/${orgId}/subscription`} className={GHOST_BUTTON_CLASS}>
          {t("licenseLink")}
        </Link>
        <Link href={`/super-admin/orgs/${orgId}/placement`} className={GHOST_BUTTON_CLASS}>
          {t("placementLink")}
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">{t("title")}</h1>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => copyUuid(orgId)}>
          {t("copyOrgUuid")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={syncing || !token}
          onClick={() => void syncSatelliteBindings()}
        >
          {syncing ? t("syncing") : t("syncBindings")}
        </button>
      </div>

      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("operatingModeTitle")}</h2>
        {mode ? (
          <p className="text-sm text-[#7F8C8D]">
            {t("operatingModeCurrent", {
              mode: mode.mode,
              parent: mode.parentOrgId ? ` · parent ${mode.parentOrgId}` : "",
              fiscal: mode.fiscalRouting,
              revenue: mode.revenueRouting,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveOperatingMode("STANDALONE")}>
            {t("setStandalone")}
          </button>
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[16rem]`}
            placeholder={t("parentOrgPlaceholder")}
            value={parentOrgId}
            onChange={(e) => setParentOrgId(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveOperatingMode("DEPARTMENT")}>
            {t("setDepartment")}
          </button>
          {mode?.mode === "DEPARTMENT" ? (
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void detachDepartment()}>
              {t("detach")}
            </button>
          ) : null}
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("departmentsTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[12rem]`}
            placeholder={t("departmentNamePlaceholder")}
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createDepartment()}>
            {t("createDepartment")}
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>{d.name}</span>
              <code className="text-xs">{d.id}</code>
              <button type="button" className="text-xs text-[#2980B9]" onClick={() => copyUuid(d.id)}>
                {t("copy")}
              </button>
            </li>
          ))}
          {departments.length === 0 ? <li className="text-[#7F8C8D]">{t("noDepartments")}</li> : null}
        </ul>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("endpointsTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("endpointsHint")}</p>
        {ENDPOINT_PRESETS.map((key) => (
          <div key={key} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-2 text-sm">
            <span className="w-40 font-mono text-xs">{key}</span>
            <input
              className={`${MODAL_INPUT_CLASS} min-w-[16rem] flex-1`}
              placeholder="http://host:port"
              value={endpointDraft[key]?.baseUrl ?? ""}
              onChange={(e) =>
                setEndpointDraft((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], baseUrl: e.target.value, enabled: prev[key]?.enabled ?? true },
                }))
              }
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={endpointDraft[key]?.enabled ?? false}
                onChange={(e) =>
                  setEndpointDraft((prev) => ({
                    ...prev,
                    [key]: {
                      baseUrl: prev[key]?.baseUrl ?? "",
                      enabled: e.target.checked,
                    },
                  }))
                }
              />
              {t("enabled")}
            </label>
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void saveEndpoint(key)}>
              {t("save")}
            </button>
          </div>
        ))}
        {endpoints.length > 0 && (
          <p className="text-xs text-[#7F8C8D]">{t("endpointsRegistered", { count: endpoints.length })}</p>
        )}
      </section>

      {showHotelBridge ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="font-medium text-[#34495E]">{t("bridgeTitle")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("bridgeHint")}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bridgeDraft.inboundEnabled}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, inboundEnabled: e.target.checked }))
                }
              />
              {t("inboundEnabled")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bridgeDraft.writeEnabled}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, writeEnabled: e.target.checked }))
                }
              />
              {t("writeEnabled")}
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-[#7F8C8D]">
              {t("elektrawebHotelId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                inputMode="numeric"
                value={bridgeDraft.elektrawebHotelId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, elektrawebHotelId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("spaDepId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                inputMode="numeric"
                value={bridgeDraft.spaDepId}
                onChange={(e) => setBridgeDraft((prev) => ({ ...prev, spaDepId: e.target.value }))}
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("spaCurrencyId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                inputMode="numeric"
                value={bridgeDraft.spaCurrencyId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, spaCurrencyId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("walkinResId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                value={bridgeDraft.walkinResId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, walkinResId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D] sm:col-span-2">
              {t("walkinResNameId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                value={bridgeDraft.walkinResNameId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, walkinResNameId: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={savingBridge || !token}
              onClick={() => void saveElektrawebBridge()}
            >
              {savingBridge ? t("saving") : t("saveBridge")}
            </button>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              disabled={syncing || !token}
              onClick={() => void syncSatelliteBindings()}
            >
              {t("saveThenSync")}
            </button>
          </div>
          {bridgeNotice ? (
            <p
              className={`text-sm ${bridgeNotice.kind === "err" ? "text-red-700" : "text-emerald-700"}`}
              role={bridgeNotice.kind === "err" ? "alert" : undefined}
            >
              {bridgeNotice.text}
            </p>
          ) : null}
        </section>
      ) : null}

      {showClinicCutover ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="font-medium text-[#34495E]">{t("cutoverTitle")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("cutoverHint")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cutoverDraft.elektrawebDualRun}
              onChange={(e) =>
                setCutoverDraft((prev) => ({ ...prev, elektrawebDualRun: e.target.checked }))
              }
            />
            {t("elektrawebDualRun")}
          </label>
          <label className="block text-xs text-[#7F8C8D]">
            {t("hotelOrganizationId")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full min-w-[16rem]`}
              placeholder={t("hotelOrganizationIdPlaceholder")}
              value={cutoverDraft.hotelOrganizationId}
              onChange={(e) =>
                setCutoverDraft((prev) => ({ ...prev, hotelOrganizationId: e.target.value }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={savingCutover || !token}
              onClick={() => void saveClinicCutover()}
            >
              {savingCutover ? t("saving") : t("saveCutover")}
            </button>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              disabled={syncing || !token}
              onClick={() => void syncSatelliteBindings()}
            >
              {t("saveThenSync")}
            </button>
          </div>
          {cutoverNotice ? (
            <p
              className={`text-sm ${cutoverNotice.kind === "err" ? "text-red-700" : "text-emerald-700"}`}
              role={cutoverNotice.kind === "err" ? "alert" : undefined}
            >
              {cutoverNotice.text}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
