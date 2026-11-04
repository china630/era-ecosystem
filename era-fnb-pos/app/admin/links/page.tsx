"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ChannelEdgeCard,
  PageHeader,
} from "@era/satellite-kit/ui";
import {
  channelEdgeTitle,
  labelChannelKind,
  labelChannelManagedBy,
  labelSatelliteKey,
} from "@era/satellite-kit";

type ChannelRow = {
  id: string;
  fromSatelliteKey: string;
  toSatelliteKey: string;
  kind: string;
  enabled: boolean;
  managedBy: string;
  fromOrgName?: string | null;
  toOrgName?: string | null;
};

type Mode = {
  mode: string;
  fiscalRouting: string;
  revenueRouting: string;
  parentOrgId: string | null;
};

export default function AdminLinksPage() {
  const t = useTranslations("adminLinks");
  const [outbound, setOutbound] = useState<ChannelRow[]>([]);
  const [inbound, setInbound] = useState<ChannelRow[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/links").catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError(t("loadFailed"));
      return;
    }
    const body = (await res.json()) as {
      outbound?: ChannelRow[];
      inbound?: ChannelRow[];
      operatingMode?: Mode | null;
    };
    setOutbound(body.outbound ?? []);
    setInbound(body.inbound ?? []);
    setMode(body.operatingMode ?? null);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(channelId: string, enabled: boolean) {
    const res = await fetch("/api/admin/links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, enabled }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(t("saveFailed"));
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("moneyTitle")}</h2>
        <p className="text-sm text-[#5D6D7E]">
          {mode
            ? t("moneyLine", {
                mode: mode.mode,
                fiscal: mode.fiscalRouting,
                revenue: mode.revenueRouting,
                parent: mode.parentOrgId ? mode.parentOrgId.slice(0, 8) : "—",
              })
            : t("moneyUnknown")}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("outbound")}</h2>
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
                onLabel={t("on")}
                offLabel={t("off")}
              />
            ))}
            {outbound.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        </section>
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("inbound")}</h2>
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
                onLabel={t("on")}
                offLabel={t("off")}
                actionLabel={c.enabled ? t("disable") : undefined}
                onAction={
                  c.enabled ? () => void toggle(c.id, false) : undefined
                }
              />
            ))}
            {inbound.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
