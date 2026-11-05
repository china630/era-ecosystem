"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  channelEdgeTitle,
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
  managedPlatform: string;
  managedAcceptor: string;
  legacyTitle?: string;
  legacyHint?: string;
};

export type SatelliteAdminLinksPanelsProps = {
  labels: SatelliteAdminLinksLabels;
  outbound: SatelliteAdminLinksChannelRow[];
  inbound: SatelliteAdminLinksChannelRow[];
  mode: SatelliteAdminLinksMode | null;
  error?: string | null;
  loading?: boolean;
  onDisableInbound?: (channelId: string) => void | Promise<void>;
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

  const managedLabel = useCallback(
    (managedBy: string) => {
      if (managedBy === "PLATFORM") return labels.managedPlatform;
      if (managedBy === "ACCEPTOR") return labels.managedAcceptor;
      return labelChannelManagedBy(managedBy);
    },
    [labels],
  );

  return { satLabel, kindLabel, managedLabel };
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
    legacyHints,
    showHeader = true,
  } = props;
  const { satLabel, kindLabel, managedLabel } = useLinkLabelFns(labels);
  const hints = legacyHints ?? CHANNEL_LEGACY_HINTS;

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
          <ul className="space-y-2">
            {outbound.map((c) => (
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
                managedLabel={managedLabel(c.managedBy)}
                enabled={c.enabled}
                onLabel={labels.on}
                offLabel={labels.off}
              />
            ))}
            {outbound.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{labels.empty}</li>
            ) : null}
          </ul>
        </section>
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{labels.inbound}</h2>
          <ul className="space-y-2">
            {inbound.map((c) => (
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
                managedLabel={managedLabel(c.managedBy)}
                enabled={c.enabled}
                onLabel={labels.on}
                offLabel={labels.off}
                actionLabel={
                  c.enabled && onDisableInbound ? labels.disable : undefined
                }
                onAction={
                  c.enabled && onDisableInbound
                    ? () => void onDisableInbound(c.id)
                    : undefined
                }
              />
            ))}
            {inbound.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{labels.empty}</li>
            ) : null}
          </ul>
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
    kindOpsHandoff: (() => {
      const tt = t as unknown as { has?: (key: string) => boolean };
      if (typeof tt.has === "function" && tt.has("kindOpsHandoff")) {
        return t("kindOpsHandoff");
      }
      return undefined;
    })(),
    managedPlatform: t("managedPlatform"),
    managedAcceptor: t("managedAcceptor"),
    legacyTitle: (() => {
      const tt = t as unknown as { has?: (key: string) => boolean };
      if (typeof tt.has === "function" && tt.has("legacyTitle")) {
        return t("legacyTitle");
      }
      return undefined;
    })(),
    legacyHint: (() => {
      const tt = t as unknown as { has?: (key: string) => boolean };
      if (typeof tt.has === "function" && tt.has("legacyHint")) {
        return t("legacyHint");
      }
      return undefined;
    })(),
  };
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

  const onDisableInbound = useCallback(
    async (channelId: string) => {
      const body =
        patchBody?.(channelId, false) ?? { channelId, enabled: false };
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
      legacyHints={hints}
    />
  );
}
