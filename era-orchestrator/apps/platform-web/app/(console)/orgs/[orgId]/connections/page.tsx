"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  ChannelEdgeCard,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  channelEdgeTitle,
  labelChannelFlowBlurb,
  labelChannelKind,
  labelChannelManagedBy,
  labelSatelliteKey,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import {
  ENDPOINT_PRESETS,
  groupChannelsByPeer,
  type ChannelRow,
  type FiscalDeviceRow,
  type OperatingMode,
  type PaymentMethodRow,
  type SatelliteEndpoint,
} from "@/lib/org-hub-shared";
import { useOrgShell } from "../org-shell";

const PAY_SAT_OPTIONS = [
  { value: "hotel", label: "hotel" },
  { value: "clinic", label: "clinic" },
  { value: "fnb", label: "fnb" },
  { value: "retail", label: "retail" },
];

const FISCAL_HINT_OPTIONS = [
  { value: "CASH", label: "CASH" },
  { value: "CARD", label: "CARD" },
  { value: "NONE", label: "NONE" },
];

type PayDraft = {
  id: string | null;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  fiscalHint: "CASH" | "CARD" | "NONE";
  satellites: string[];
  active: boolean;
};

const EMPTY_PAY: PayDraft = {
  id: null,
  code: "",
  nameAz: "",
  nameRu: "",
  nameEn: "",
  fiscalHint: "CASH",
  satellites: ["hotel", "clinic", "fnb", "retail"],
  active: true,
};

export default function OrgConnectionsPage() {
  const { orgId, mode: shellMode } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [mode, setMode] = useState<OperatingMode | null>(shellMode);
  const [endpoints, setEndpoints] = useState<SatelliteEndpoint[]>([]);
  const [endpointDraft, setEndpointDraft] = useState<
    Record<string, { baseUrl: string; enabled: boolean }>
  >({});
  const [fiscalDevices, setFiscalDevices] = useState<FiscalDeviceRow[]>([]);
  const [fiscalDraft, setFiscalDraft] = useState({
    kind: "FISCAL_KKM",
    providerId: "mock",
    label: "",
    outletCode: "",
    registerCode: "",
    endpoint: "",
    secrets: "",
    isOrgDefault: false,
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payDraft, setPayDraft] = useState<PayDraft>(EMPTY_PAY);
  const [savingPay, setSavingPay] = useState(false);
  const [channelsOut, setChannelsOut] = useState<ChannelRow[]>([]);
  const [channelsIn, setChannelsIn] = useState<ChannelRow[]>([]);
  const [resyncingChannels, setResyncingChannels] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const satLabel = useCallback(
    (key: string) => {
      switch (key) {
        case "industry_hotel_pms":
          return t("satHotel");
        case "industry_clinic":
          return t("satClinic");
        case "industry_fnb_pos":
          return t("satFnb");
        case "industry_retail":
          return t("satRetail");
        case "finance_core":
          return t("satFinance");
        default:
          return labelSatelliteKey(key);
      }
    },
    [t],
  );
  const kindLabel = useCallback(
    (kind: string) => {
      switch (kind) {
        case "FOLIO_POST":
          return t("kindFolio");
        case "SETTLEMENT":
          return t("kindSettlement");
        case "REVENUE_EVENT":
          return t("kindRevenue");
        case "READ_STATUS":
          return t("kindRead");
        case "OPS_HANDOFF":
          return t("kindOpsHandoff");
        default:
          return labelChannelKind(kind);
      }
    },
    [t],
  );
  const managedLabel = useCallback(
    (managedBy: string) => {
      if (managedBy === "PLATFORM") return t("managedPlatform");
      if (managedBy === "ACCEPTOR") return t("managedAcceptor");
      return labelChannelManagedBy(managedBy);
    },
    [t],
  );
  const flowBlurb = useCallback(
    (kind: string) => {
      switch (kind) {
        case "FOLIO_POST":
          return t("flowFolio");
        case "SETTLEMENT":
          return t("flowSettlement");
        case "REVENUE_EVENT":
          return t("flowRevenue");
        case "READ_STATUS":
          return t("flowRead");
        case "OPS_HANDOFF":
          return t("flowOpsHandoff");
        default:
          return labelChannelFlowBlurb(kind);
      }
    },
    [t],
  );

  const parentCash =
    mode?.mode === "DEPARTMENT" && mode.fiscalRouting === "PARENT";

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, epRes, fiscalRes, payRes, chRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/payment-methods`, { token }),
        orchFetch(`/v1/admin/organizations/${orgId}/channels`, { token }),
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
      if (fiscalRes.ok) setFiscalDevices((await fiscalRes.json()) as FiscalDeviceRow[]);
      if (payRes.ok) setPaymentMethods((await payRes.json()) as PaymentMethodRow[]);
      if (chRes.ok) {
        const body = (await chRes.json()) as {
          outbound?: ChannelRow[];
          inbound?: ChannelRow[];
        };
        setChannelsOut(body.outbound ?? []);
        setChannelsIn(body.inbound ?? []);
      } else {
        setChannelsOut([]);
        setChannelsIn([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setMode(shellMode);
  }, [shellMode]);

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

  async function toggleChannel(channelId: string, enabled: boolean) {
    if (!token) return;
    setMessage("");
    const res = await orchFetch(
      `/v1/admin/organizations/${orgId}/channels/${channelId}`,
      {
        token,
        method: "PATCH",
        body: JSON.stringify(
          enabled ? { enabled: true, managedBy: "PLATFORM" } : { enabled },
        ),
      },
    );
    if (!res.ok) {
      setMessage(t("channelsSaveFailed", { status: res.status }));
      return;
    }
    setMessage(t("channelsSaved"));
    await reload();
  }

  async function resyncChannels() {
    if (!token) return;
    setMessage("");
    setResyncingChannels(true);
    try {
      const res = await orchFetch(
        `/v1/admin/organizations/${orgId}/channels/resync`,
        { token, method: "POST" },
      );
      if (!res.ok) {
        setMessage(t("channelsResyncFailed", { status: res.status }));
        return;
      }
      const body = (await res.json()) as {
        outbound?: ChannelRow[];
        inbound?: ChannelRow[];
      };
      setChannelsOut(body.outbound ?? []);
      setChannelsIn(body.inbound ?? []);
      setMessage(t("channelsResynced"));
    } finally {
      setResyncingChannels(false);
    }
  }

  async function addFiscalDevice() {
    if (!token || !fiscalDraft.label.trim()) return;
    setSavingFiscal(true);
    setMessage("");
    let secrets: Record<string, string> | undefined;
    if (fiscalDraft.secrets.trim()) {
      try {
        secrets = JSON.parse(fiscalDraft.secrets) as Record<string, string>;
      } catch {
        setMessage(t("fiscalSaveFailed", { status: "JSON" }));
        setSavingFiscal(false);
        return;
      }
    }
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices`, {
        token,
        method: "POST",
        body: JSON.stringify({
          kind: fiscalDraft.kind,
          providerId: fiscalDraft.providerId,
          label: fiscalDraft.label.trim(),
          outletCode: fiscalDraft.outletCode.trim() || null,
          registerCode: fiscalDraft.registerCode.trim() || null,
          endpoint: fiscalDraft.endpoint.trim() || null,
          secrets: secrets ?? undefined,
          isOrgDefault: fiscalDraft.isOrgDefault,
        }),
      });
      if (!res.ok) {
        setMessage(t("fiscalSaveFailed", { status: res.status }));
        return;
      }
      setFiscalDraft((d) => ({ ...d, label: "", secrets: "" }));
      setMessage(t("fiscalSaved"));
      await reload();
    } finally {
      setSavingFiscal(false);
    }
  }

  async function retireFiscalDevice(deviceId: string) {
    if (!token) return;
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices/${deviceId}`, {
      token,
      method: "DELETE",
    });
    if (!res.ok) {
      setMessage(t("fiscalSaveFailed", { status: res.status }));
      return;
    }
    setMessage(t("fiscalRetired"));
    await reload();
  }

  function openCreatePay() {
    setPayDraft(EMPTY_PAY);
    setPayModalOpen(true);
  }

  function openEditPay(row: PaymentMethodRow) {
    setPayDraft({
      id: row.id,
      code: row.code,
      nameAz: row.nameAz,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      fiscalHint: (row.fiscalHint as PayDraft["fiscalHint"]) || "NONE",
      satellites: row.satellites ?? [],
      active: row.active,
    });
    setPayModalOpen(true);
  }

  async function savePay() {
    if (!token) return;
    if (
      !payDraft.nameAz.trim() ||
      !payDraft.nameRu.trim() ||
      !payDraft.nameEn.trim() ||
      payDraft.satellites.length === 0
    ) {
      setMessage(t("payValidation"));
      return;
    }
    if (!payDraft.id && !payDraft.code.trim()) {
      setMessage(t("payValidation"));
      return;
    }
    setSavingPay(true);
    setMessage("");
    try {
      const body = {
        code: payDraft.code.trim() || undefined,
        nameAz: payDraft.nameAz.trim(),
        nameRu: payDraft.nameRu.trim(),
        nameEn: payDraft.nameEn.trim(),
        fiscalHint: payDraft.fiscalHint,
        satellites: payDraft.satellites,
        active: payDraft.active,
      };
      const res = payDraft.id
        ? await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods/${payDraft.id}`, {
            token,
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods`, {
            token,
            method: "POST",
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        setMessage(t("paySaveFailed", { status: res.status }));
        return;
      }
      setPayModalOpen(false);
      setMessage(t("paySaved"));
      await reload();
    } finally {
      setSavingPay(false);
    }
  }

  async function deactivatePay(id: string) {
    if (!token) return;
    if (!window.confirm(t("payDisableConfirm"))) return;
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods/${id}`, {
      token,
      method: "DELETE",
    });
    if (!res.ok) {
      setMessage(t("paySaveFailed", { status: res.status }));
      return;
    }
    setMessage(t("paySaved"));
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium text-[#34495E]">{t("channelsTitle")}</h2>
            <p className="text-xs text-[#7F8C8D]">{t("channelsHint")}</p>
          </div>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            disabled={resyncingChannels}
            onClick={() => void resyncChannels()}
          >
            {resyncingChannels ? t("channelsResyncing") : t("channelsResync")}
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#5D6D7E]">{t("channelsOutbound")}</h3>
            {groupChannelsByPeer(channelsOut, "outbound").map((group) => (
              <div key={`out-${group.peerKey}`} className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-[#95A5A6]">
                  {satLabel(group.peerKey)}
                </h4>
                <ul className="space-y-2">
                  {group.channels.map((c) => (
                    <ChannelEdgeCard
                      key={c.id}
                      title={channelEdgeTitle({
                        fromKey: c.fromSatelliteKey,
                        toKey: c.toSatelliteKey,
                        fromOrgName: c.fromOrgName,
                        toOrgName: c.toOrgName,
                        direction: "outbound",
                        labelSat: satLabel,
                      })}
                      detail={`${c.fromSatelliteKey} → ${c.toSatelliteKey}`}
                      kindLabel={kindLabel(c.kind)}
                      flowBlurb={flowBlurb(c.kind)}
                      managedLabel={managedLabel(c.managedBy)}
                      enabled={c.enabled}
                      onLabel={t("channelsOn")}
                      offLabel={t("channelsOff")}
                      actionLabel={
                        c.enabled ? t("channelsDisable") : t("channelsEnable")
                      }
                      actionTone={c.enabled ? "danger" : "secondary"}
                      onAction={() => void toggleChannel(c.id, !c.enabled)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {channelsOut.length === 0 ? (
              <p className="text-sm text-[#7F8C8D]">{t("channelsEmpty")}</p>
            ) : null}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#5D6D7E]">{t("channelsInbound")}</h3>
            {groupChannelsByPeer(channelsIn, "inbound").map((group) => (
              <div key={`in-${group.peerKey}`} className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-[#95A5A6]">
                  {satLabel(group.peerKey)}
                </h4>
                <ul className="space-y-2">
                  {group.channels.map((c) => (
                    <ChannelEdgeCard
                      key={c.id}
                      title={channelEdgeTitle({
                        fromKey: c.fromSatelliteKey,
                        toKey: c.toSatelliteKey,
                        fromOrgName: c.fromOrgName,
                        toOrgName: c.toOrgName,
                        direction: "inbound",
                        labelSat: satLabel,
                      })}
                      detail={`${c.fromSatelliteKey} → ${c.toSatelliteKey}`}
                      kindLabel={kindLabel(c.kind)}
                      flowBlurb={flowBlurb(c.kind)}
                      managedLabel={managedLabel(c.managedBy)}
                      enabled={c.enabled}
                      onLabel={t("channelsOn")}
                      offLabel={t("channelsOff")}
                      actionLabel={
                        c.enabled ? t("channelsDisable") : t("channelsEnable")
                      }
                      actionTone={c.enabled ? "danger" : "secondary"}
                      onAction={() => void toggleChannel(c.id, !c.enabled)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {channelsIn.length === 0 ? (
              <p className="text-sm text-[#7F8C8D]">{t("channelsEmpty")}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("fiscalTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("fiscalHint")}</p>
        <ul className="space-y-1 text-sm">
          {fiscalDevices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>
                {d.label} · {d.kind} · {d.providerId}
                {d.isOrgDefault ? ` · ${t("fiscalDefaultMark")}` : ""}
                {d.hasSecrets ? ` · ${t("fiscalSecretsMark")}` : ""}
              </span>
              <button
                type="button"
                className="text-xs text-[#E74C3C]"
                onClick={() => void retireFiscalDevice(d.id)}
              >
                {t("fiscalRetire")}
              </button>
            </li>
          ))}
          {fiscalDevices.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("fiscalEmpty")}</li>
          ) : null}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalKind")}
            <select
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.kind}
              onChange={(e) => setFiscalDraft((d) => ({ ...d, kind: e.target.value }))}
            >
              <option value="FISCAL_KKM">KKM</option>
              <option value="BANK_POS">BANK_POS</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalProvider")}
            <select
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.providerId}
              onChange={(e) =>
                setFiscalDraft((d) => ({ ...d, providerId: e.target.value }))
              }
            >
              <option value="mock">mock</option>
              <option value="omnitech">omnitech</option>
              <option value="nbc">nbc</option>
              <option value="cybernet">cybernet</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalLabel")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.label}
              onChange={(e) => setFiscalDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalOutlet")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.outletCode}
              onChange={(e) =>
                setFiscalDraft((d) => ({ ...d, outletCode: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalRegister")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.registerCode}
              onChange={(e) =>
                setFiscalDraft((d) => ({ ...d, registerCode: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalEndpoint")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.endpoint}
              onChange={(e) =>
                setFiscalDraft((d) => ({ ...d, endpoint: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D] sm:col-span-2">
            {t("fiscalSecrets")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={fiscalDraft.secrets}
              onChange={(e) =>
                setFiscalDraft((d) => ({ ...d, secrets: e.target.value }))
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fiscalDraft.isOrgDefault}
            onChange={(e) =>
              setFiscalDraft((d) => ({ ...d, isOrgDefault: e.target.checked }))
            }
          />
          {t("fiscalOrgDefault")}
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={savingFiscal || !token}
          onClick={() => void addFiscalDevice()}
        >
          {savingFiscal ? t("saving") : t("fiscalAdd")}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium text-[#34495E]">{t("payTitle")}</h2>
            <p className="text-xs text-[#7F8C8D]">{t("payHint")}</p>
          </div>
          {!parentCash ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreatePay}>
              {t("payAdd")}
            </button>
          ) : null}
        </div>
        {parentCash ? (
          <p className="text-xs text-[#2980B9]">{t("payParentCash")}</p>
        ) : null}
        <ul className="space-y-1 text-sm">
          {paymentMethods.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-[#2980B9]">{row.code}</code>
              <span>
                {row.nameEn} · {row.fiscalHint} · {(row.satellites ?? []).join(",")}
                {!row.active ? ` · ${t("payOff")}` : ""}
              </span>
              {!parentCash ? (
                <>
                  <button
                    type="button"
                    className="text-xs text-[#2980B9]"
                    onClick={() => openEditPay(row)}
                  >
                    {t("payEdit")}
                  </button>
                  {row.active ? (
                    <button
                      type="button"
                      className="text-xs text-[#E74C3C]"
                      onClick={() => void deactivatePay(row.id)}
                    >
                      {t("payDisable")}
                    </button>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
          {paymentMethods.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("payEmpty")}</li>
          ) : null}
        </ul>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("endpointsTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("endpointsHint")}</p>
        {ENDPOINT_PRESETS.map((key) => (
          <div
            key={key}
            className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-2 text-sm"
          >
            <span className="w-40 text-sm font-medium text-[#34495E]">{satLabel(key)}</span>
            <label className="flex min-w-[16rem] flex-1 flex-col text-xs text-[#7F8C8D]">
              {t("endpointUrlLabel")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1`}
                value={endpointDraft[key]?.baseUrl ?? ""}
                onChange={(e) =>
                  setEndpointDraft((prev) => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      baseUrl: e.target.value,
                      enabled: prev[key]?.enabled ?? true,
                    },
                  }))
                }
              />
            </label>
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
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => void saveEndpoint(key)}
            >
              {t("save")}
            </button>
          </div>
        ))}
        {endpoints.length > 0 ? (
          <p className="text-xs text-[#7F8C8D]">
            {t("endpointsRegistered", { count: endpoints.length })}
          </p>
        ) : null}
      </section>

      <ModalShell
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={payDraft.id ? t("payEditTitle") : t("payAdd")}
      >
        <div className="space-y-3 p-1">
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payCode")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={payDraft.code}
              disabled={Boolean(payDraft.id)}
              onChange={(e) => setPayDraft((d) => ({ ...d, code: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameEn")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={payDraft.nameEn}
              onChange={(e) => setPayDraft((d) => ({ ...d, nameEn: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameRu")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={payDraft.nameRu}
              onChange={(e) => setPayDraft((d) => ({ ...d, nameRu: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameAz")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={payDraft.nameAz}
              onChange={(e) => setPayDraft((d) => ({ ...d, nameAz: e.target.value }))}
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("payFiscalHint")}
            value={payDraft.fiscalHint}
            onChange={(next) =>
              setPayDraft((d) => ({
                ...d,
                fiscalHint: next as PayDraft["fiscalHint"],
              }))
            }
            options={FISCAL_HINT_OPTIONS}
          />
          <CatalogField
            kind="MULTI"
            label={t("paySatellites")}
            value={payDraft.satellites}
            onChange={(next) =>
              setPayDraft((d) => ({
                ...d,
                satellites: Array.isArray(next) ? next.map(String) : [],
              }))
            }
            options={PAY_SAT_OPTIONS}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payDraft.active}
              onChange={(e) => setPayDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            {t("payActive")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={savingPay}
              onClick={() => void savePay()}
            >
              {savingPay ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => setPayModalOpen(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
