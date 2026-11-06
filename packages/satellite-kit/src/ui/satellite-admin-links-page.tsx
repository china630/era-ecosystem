"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  channelEdgeTitle,
  labelChannelFlowBlurb,
  labelChannelKind,
  labelChannelManagedBy,
  labelSatelliteKey,
} from "../integration/satellite-channels-display";
import type { ChannelLegacyHint } from "../integration/channel-legacy-hints";
import { CHANNEL_LEGACY_HINTS } from "../integration/channel-legacy-hints";
import { CARD_CONTAINER_CLASS } from "./design-system";
import { ChannelEdgeCard } from "./channel-edge-card";
import { PageHeader } from "./page-header";

export type SatelliteAdminLinksChannelRow = {
  id: string;
  fromSatelliteKey: string;
  toSatelliteKey: string;
  kind: string;
  enabled: boolean;
  managedBy: string;
  fromOrgName?: string | null;
  toOrgName?: string | null;
};

export type SatelliteAdminLinksMode = {
  mode: string;
  fiscalRouting: string;
  revenueRouting: string;
  parentOrgId: string | null;
};

export type SatelliteAdminLinksLabels = {
  title: string;
  subtitle: string;
  loadFailed: string;
  saveFailed: string;
  loading: string;
  moneyTitle: string;
  moneyLine: (vars: {
    mode: string;
    fiscal: string;
    revenue: string;
    parent: string;
  }) => string;
  moneyUnknown: string;
  outbound: string;
  inbound: string;
  empty: string;
  on: string;
  off: string;
  disable: string;
  satHotel: string;
  satClinic: string;
  satFnb: string;
  satRetail: string;
  satFinance: string;
  kindFolio: string;
  kindSettlement: string;
  kindRevenue: string;
  kindRead: string;
  kindOpsHandoff?: string;
  flowFolio?: string;
  flowSettlement?: string;
  flowRevenue?: string;
  flowRead?: string;
  flowOpsHandoff?: string;
  managedPlatform: string;
  managedAcceptor: string;
  legacyTitle?: string;
  legacyHint?: string;
  enable?: string;
};

export type SatelliteAdminLinksPanelsProps = {
  labels: SatelliteAdminLinksLabels;
  outbound: SatelliteAdminLinksChannelRow[];
  inbound: SatelliteAdminLinksChannelRow[];
  mode: SatelliteAdminLinksMode | null;
  error?: string | null;
  loading?: boolean;
  onDisableInbound?: (channelId: string) => void | Promise<void>;
  onEnableInbound?: (channelId: string) => void | Promise<void>;
  /** Optional display-only CODE_LEGACY rows (never enables gates). */
  legacyHints?: readonly ChannelLegacyHint[];
  /** When false, omit PageHeader (host already rendered one). */
  showHeader?: boolean;
};

function useLinkLabelFns(labels: SatelliteAdminLinksLabels) {
  const satLabel = useCallback(
    (key: string) => {
      switch (key) {
        case "industry_hotel_pms":
          return labels.satHotel;
        case "industry_clinic":
          return labels.satClinic;
        case "industry_fnb_pos":
          return labels.satFnb;
        case "industry_retail":
          return labels.satRetail;
        case "finance_core":
          return labels.satFinance;
        default:
          return labelSatelliteKey(key);
      }
    },
    [labels],
  );

  const kindLabel = useCallback(
    (kind: string) => {
      switch (kind) {
        case "FOLIO_POST":
          return labels.kindFolio;
        case "SETTLEMENT":
          return labels.kindSettlement;
        case "REVENUE_EVENT":
          return labels.kindRevenue;
        case "READ_STATUS":
          return labels.kindRead;
        case "OPS_HANDOFF":
          return labels.kindOpsHandoff ?? labelChannelKind(kind);
        default:
          return labelChannelKind(kind);
      }
    },
    [labels],
  );

  const flowBlurb = useCallback(
    (kind: string) => {
      switch (kind) {
        case "FOLIO_POST":
          return labels.flowFolio ?? labelChannelFlowBlurb(kind);
        case "SETTLEMENT":
          return labels.flowSettlement ?? labelChannelFlowBlurb(kind);
        case "REVENUE_EVENT":
          return labels.flowRevenue ?? labelChannelFlowBlurb(kind);
        case "READ_STATUS":
          return labels.flowRead ?? labelChannelFlowBlurb(kind);
        case "OPS_HANDOFF":
          return labels.flowOpsHandoff ?? labelChannelFlowBlurb(kind);
        default:
          return labelChannelFlowBlurb(kind);
      }
    },
    [labels],
  );

  const managedLabel = useCallback(
    (managedBy: string) => {
      if (managedBy === "PLATFORM") return labels.managedPlatform;
      if (managedBy === "ACCEPTOR") return labels.managedAcceptor;
      return labelChannelManagedBy(managedBy);
    },
    [labels],
  );

  return { satLabel, kindLabel, flowBlurb, managedLabel };
}

function peerGroupKey(
  row: SatelliteAdminLinksChannelRow,
  direction: "outbound" | "inbound",
): string {
  return direction === "outbound" ? row.toSatelliteKey : row.fromSatelliteKey;
}

function groupByPeer(
  rows: SatelliteAdminLinksChannelRow[],
  direction: "outbound" | "inbound",
): Array<{ peerKey: string; channels: SatelliteAdminLinksChannelRow[] }> {
  const order: string[] = [];
  const map = new Map<string, SatelliteAdminLinksChannelRow[]>();
  for (const row of rows) {
    const key = peerGroupKey(row, direction);
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  return order.map((peerKey) => ({
    peerKey,
    channels: map.get(peerKey)!,
  }));
}

/** Presentational money + inbound/outbound channel cards (shared by industry + finance). */
export function SatelliteAdminLinksPanels(props: SatelliteAdminLinksPanelsProps) {
  const {
    labels,
    outbound,
    inbound,
    mode,
    error = null,
    loading = false,
    onDisableInbound,
    onEnableInbound,
    legacyHints,
    showHeader = true,
  } = props;
  const { satLabel, kindLabel, flowBlurb, managedLabel } = useLinkLabelFns(labels);
  const hints = legacyHints ?? CHANNEL_LEGACY_HINTS;
  const outboundGroups = groupByPeer(outbound, "outbound");
  const inboundGroups = groupByPeer(inbound, "inbound");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      {showHeader ? (
        <PageHeader title={labels.title} subtitle={labels.subtitle} />
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{labels.loading}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{labels.moneyTitle}</h2>
        <p className="text-sm text-[#5D6D7E]">
          {mode
            ? labels.moneyLine({
                mode: mode.mode,
                fiscal: mode.fiscalRouting,
                revenue: mode.revenueRouting,
                parent: mode.parentOrgId ? mode.parentOrgId.slice(0, 8) : "—",
              })
            : labels.moneyUnknown}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{labels.outbound}</h2>
          {outboundGroups.map((group) => (
            <div key={`out-${group.peerKey}`} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#95A5A6]">
                {satLabel(group.peerKey)}
              </h3>
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
                    onLabel={labels.on}
                    offLabel={labels.off}
                  />
                ))}
              </ul>
            </div>
          ))}
          {outbound.length === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{labels.empty}</p>
          ) : null}
        </section>
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{labels.inbound}</h2>
          {inboundGroups.map((group) => (
            <div key={`in-${group.peerKey}`} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#95A5A6]">
                {satLabel(group.peerKey)}
              </h3>
              <ul className="space-y-2">
                {group.channels.map((c) => {
                  const canDisable = c.enabled && onDisableInbound;
                  const canEnable = !c.enabled && onEnableInbound;
                  return (
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
                      onLabel={labels.on}
                      offLabel={labels.off}
                      actionLabel={
                        canDisable
                          ? labels.disable
                          : canEnable
                            ? labels.enable ?? labels.on
                            : undefined
                      }
                      actionTone={canDisable ? "danger" : "secondary"}
                      onAction={
                        canDisable
                          ? () => void onDisableInbound!(c.id)
                          : canEnable
                            ? () => void onEnableInbound!(c.id)
                            : undefined
                      }
                    />
                  );
                })}
              </ul>
            </div>
          ))}
          {inbound.length === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{labels.empty}</p>
          ) : null}
        </section>
      </div>

      {hints.length > 0 ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">
            {labels.legacyTitle ?? "Legacy bridges"}
          </h2>
          <p className="text-xs text-[#7F8C8D]">
            {labels.legacyHint ??
              "Display-only CODE_LEGACY hints — not live channel gates."}
          </p>
          <ul className="space-y-1 text-sm text-[#5D6D7E]">
            {hints.map((h, i) => (
              <li key={`${h.fromSatelliteKey}-${h.toSatelliteKey}-${h.kind}-${i}`}>
                {satLabel(h.fromSatelliteKey)} → {satLabel(h.toSatelliteKey)} ·{" "}
                {kindLabel(h.kind)} — {h.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export type SatelliteAdminLinksPageProps = {
  labels: SatelliteAdminLinksLabels;
  /** Default `/api/admin/links` (GET list, PATCH `{ channelId, enabled }`). */
  apiPath?: string;
  legacyHints?: readonly ChannelLegacyHint[];
  /** Override fetch (e.g. finance apiFetch). */
  fetchImpl?: typeof fetch;
  /** PATCH body builder; default satellite admin shape. */
  patchBody?: (channelId: string, enabled: boolean) => unknown;
  /** When set, PATCH goes to `${apiPath}/${channelId}` instead of apiPath. */
  patchPathStyle?: "body" | "path";
};

/** Map next-intl `useTranslations("adminLinks")` (or compatible) to labels. */
export function satelliteAdminLinksLabelsFromT(
  t: (key: string, values?: Record<string, string>) => string,
): SatelliteAdminLinksLabels {
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    loadFailed: t("loadFailed"),
    saveFailed: t("saveFailed"),
    loading: t("loading"),
    moneyTitle: t("moneyTitle"),
    moneyLine: (vars) => t("moneyLine", vars),
    moneyUnknown: t("moneyUnknown"),
    outbound: t("outbound"),
    inbound: t("inbound"),
    empty: t("empty"),
    on: t("on"),
    off: t("off"),
    disable: t("disable"),
    satHotel: t("satHotel"),
    satClinic: t("satClinic"),
    satFnb: t("satFnb"),
    satRetail: t("satRetail"),
    satFinance: t("satFinance"),
    kindFolio: t("kindFolio"),
    kindSettlement: t("kindSettlement"),
    kindRevenue: t("kindRevenue"),
    kindRead: t("kindRead"),
    kindOpsHandoff: optionalT(t, "kindOpsHandoff"),
    flowFolio: optionalT(t, "flowFolio"),
    flowSettlement: optionalT(t, "flowSettlement"),
    flowRevenue: optionalT(t, "flowRevenue"),
    flowRead: optionalT(t, "flowRead"),
    flowOpsHandoff: optionalT(t, "flowOpsHandoff"),
    managedPlatform: t("managedPlatform"),
    managedAcceptor: t("managedAcceptor"),
    legacyTitle: optionalT(t, "legacyTitle"),
    legacyHint: optionalT(t, "legacyHint"),
    enable: optionalT(t, "enable"),
  };
}

function optionalT(
  t: (key: string, values?: Record<string, string>) => string,
  key: string,
): string | undefined {
  const tt = t as unknown as { has?: (k: string) => boolean };
  if (typeof tt.has === "function" && tt.has(key)) {
    return t(key);
  }
  return undefined;
}

/**
 * Shared SatAdmin integration-links page: fetch + inbound disable + panels.
 */
export function SatelliteAdminLinksPage(props: SatelliteAdminLinksPageProps) {
  const {
    labels,
    apiPath = "/api/admin/links",
    legacyHints,
    fetchImpl = fetch,
    patchBody,
    patchPathStyle = "body",
  } = props;
  const [outbound, setOutbound] = useState<SatelliteAdminLinksChannelRow[]>([]);
  const [inbound, setInbound] = useState<SatelliteAdminLinksChannelRow[]>([]);
  const [mode, setMode] = useState<SatelliteAdminLinksMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchImpl(apiPath).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError(labels.loadFailed);
      return;
    }
    const body = (await res.json()) as {
      outbound?: SatelliteAdminLinksChannelRow[];
      inbound?: SatelliteAdminLinksChannelRow[];
      operatingMode?: SatelliteAdminLinksMode | null;
    };
    setOutbound(body.outbound ?? []);
    setInbound(body.inbound ?? []);
    setMode(body.operatingMode ?? null);
  }, [apiPath, fetchImpl, labels.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchEnabled = useCallback(
    async (channelId: string, enabled: boolean) => {
      const body =
        patchBody?.(channelId, enabled) ?? { channelId, enabled };
      const url =
        patchPathStyle === "path" ? `${apiPath}/${channelId}` : apiPath;
      const res = await fetchImpl(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!res?.ok) {
        setError(labels.saveFailed);
        return;
      }
      await load();
    },
    [apiPath, fetchImpl, labels.saveFailed, load, patchBody, patchPathStyle],
  );

  const onDisableInbound = useCallback(
    (channelId: string) => patchEnabled(channelId, false),
    [patchEnabled],
  );

  const onEnableInbound = useCallback(
    (channelId: string) => patchEnabled(channelId, true),
    [patchEnabled],
  );

  const hints = useMemo(
    () => legacyHints ?? CHANNEL_LEGACY_HINTS,
    [legacyHints],
  );

  return (
    <SatelliteAdminLinksPanels
      labels={labels}
      outbound={outbound}
      inbound={inbound}
      mode={mode}
      error={error}
      loading={loading}
      onDisableInbound={onDisableInbound}
      onEnableInbound={onEnableInbound}
      legacyHints={hints}
    />
  );
}
