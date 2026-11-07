"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import {
  EMPTY_BRIDGE,
  EMPTY_CUTOVER,
  noticeFromFailedResponse,
  parseOptionalInt,
  resolveCutoverIndustries,
  showCutoverTab,
  undeliveredSatellites,
  type BridgeDraft,
  type CutoverDraft,
  type FieldNotice,
  type OperatingMode,
  type VendorBridgeBundle,
} from "@/lib/org-hub-shared";
import { useOrgShell } from "../org-shell";

export default function OrgCutoverPage() {
  const { orgId, meta, mode: shellMode } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [bridgeDraft, setBridgeDraft] = useState<BridgeDraft>(EMPTY_BRIDGE);
  const [cutoverDraft, setCutoverDraft] = useState<CutoverDraft>(EMPTY_CUTOVER);
  const [industries, setIndustries] = useState<string[]>(meta.industries);
  const [bridgeNotice, setBridgeNotice] = useState<FieldNotice | null>(null);
  const [cutoverNotice, setCutoverNotice] = useState<FieldNotice | null>(null);
  const [savingBridge, setSavingBridge] = useState(false);
  const [savingCutover, setSavingCutover] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const visible = showCutoverTab(industries);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [bridgeRes, epRes, modeRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/elektraweb-bridge`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
      ]);
      let bridgeIndustries: string[] = [];
      if (bridgeRes.ok) {
        const bundle = (await bridgeRes.json()) as VendorBridgeBundle;
        bridgeIndustries = bundle.industries ?? [];
        const b = bundle.elektrawebBridge;
        setBridgeDraft(
          b
            ? {
                inboundEnabled: b.inboundEnabled,
                writeEnabled: b.writeEnabled,
                elektrawebHotelId:
                  b.elektrawebHotelId != null ? String(b.elektrawebHotelId) : "",
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
      let endpoints: Array<{ satelliteKey: string; enabled: boolean }> = [];
      if (epRes.ok) {
        endpoints = (await epRes.json()) as Array<{
          satelliteKey: string;
          enabled: boolean;
        }>;
      }
      let operatingMode: string | null = shellMode?.mode ?? meta.mode;
      if (modeRes.ok) {
        const mode = (await modeRes.json()) as OperatingMode;
        operatingMode = mode.mode;
      }
      setIndustries(
        resolveCutoverIndustries({
          bridgeIndustries,
          endpoints,
          operatingMode,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [token, orgId, shellMode?.mode, meta.mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        results?: Array<{ satelliteKey: string; ok: boolean; error?: string }>;
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
      const missed = await undeliveredSatellites(res);
      setBridgeNotice(
        missed
          ? { kind: "err", text: t("policySavedNotDelivered", { targets: missed }) }
          : { kind: "ok", text: t("bridgeSaved") },
      );
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
      const missed = await undeliveredSatellites(res);
      setCutoverNotice(
        missed
          ? { kind: "err", text: t("policySavedNotDelivered", { targets: missed }) }
          : { kind: "ok", text: t("cutoverSaved") },
      );
      await reload();
    } finally {
      setSavingCutover(false);
    }
  }

  if (!loading && !visible) {
    return (
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <p className="text-sm text-[#7F8C8D]">{t("cutoverUnavailable")}</p>
        <Link href={`/orgs/${orgId}`} className={GHOST_BUTTON_CLASS}>
          {t("backToOverview")}
        </Link>
      </div>
    );
  }

  const showHotel = industries.includes("hotel");
  const showClinic = industries.includes("clinic");

  return (
    <div className="space-y-6">
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {showHotel ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="font-medium text-[#34495E]">{t("bridgeTitle")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("bridgeHint")}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bridgeDraft.inboundEnabled}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({
                    ...prev,
                    inboundEnabled: e.target.checked,
                  }))
                }
              />
              {t("inboundEnabled")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bridgeDraft.writeEnabled}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({
                    ...prev,
                    writeEnabled: e.target.checked,
                  }))
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
                  setBridgeDraft((prev) => ({
                    ...prev,
                    elektrawebHotelId: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("spaDepId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                inputMode="numeric"
                value={bridgeDraft.spaDepId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({ ...prev, spaDepId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("spaCurrencyId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                inputMode="numeric"
                value={bridgeDraft.spaCurrencyId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({
                    ...prev,
                    spaCurrencyId: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D]">
              {t("walkinResId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                value={bridgeDraft.walkinResId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({
                    ...prev,
                    walkinResId: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-[#7F8C8D] sm:col-span-2">
              {t("walkinResNameId")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                value={bridgeDraft.walkinResNameId}
                onChange={(e) =>
                  setBridgeDraft((prev) => ({
                    ...prev,
                    walkinResNameId: e.target.value,
                  }))
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

      {showClinic ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="font-medium text-[#34495E]">{t("cutoverTitle")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("cutoverHint")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cutoverDraft.elektrawebDualRun}
              onChange={(e) =>
                setCutoverDraft((prev) => ({
                  ...prev,
                  elektrawebDualRun: e.target.checked,
                }))
              }
            />
            {t("elektrawebDualRun")}
          </label>
          <label className="block text-xs text-[#7F8C8D]">
            {t("hotelOrganizationId")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full min-w-[16rem]`}
              value={cutoverDraft.hotelOrganizationId}
              onChange={(e) =>
                setCutoverDraft((prev) => ({
                  ...prev,
                  hotelOrganizationId: e.target.value,
                }))
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
