"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ChannelEdgeCard,
  GHOST_BUTTON_CLASS,
  PageHeader,
  channelEdgeTitle,
  labelChannelFlowBlurb,
  labelChannelKind,
  labelChannelManagedBy,
  labelSatelliteKey,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import { groupChannelsByPeer, type ChannelRow } from "@/lib/org-hub-shared";
import { useOrgShell } from "../org-shell";

export default function OrgChannelsPage() {
  const { orgId } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [channelsOut, setChannelsOut] = useState<ChannelRow[]>([]);
  const [channelsIn, setChannelsIn] = useState<ChannelRow[]>([]);
  const [resyncing, setResyncing] = useState(false);
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

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const chRes = await orchFetch(`/v1/admin/organizations/${orgId}/channels`, { token });
      if (chRes.ok) {
        const body = (await chRes.json()) as { outbound?: ChannelRow[]; inbound?: ChannelRow[] };
        setChannelsOut(body.outbound ?? []);
        setChannelsIn(body.inbound ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggleChannel(channelId: string, enabled: boolean) {
    if (!token) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/organizations/${orgId}/channels/${channelId}`, {
      token,
      method: "PATCH",
      body: JSON.stringify(enabled ? { enabled: true, managedBy: "PLATFORM" } : { enabled }),
    });
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
    setResyncing(true);
    try {
      const res = await orchFetch(`/v1/admin/organizations/${orgId}/channels/resync`, {
        token,
        method: "POST",
      });
      if (!res.ok) {
        setMessage(t("channelsResyncFailed", { status: res.status }));
        return;
      }
      const body = (await res.json()) as { outbound?: ChannelRow[]; inbound?: ChannelRow[] };
      setChannelsOut(body.outbound ?? []);
      setChannelsIn(body.inbound ?? []);
      setMessage(t("channelsResynced"));
    } finally {
      setResyncing(false);
    }
  }

  function column(title: string, rows: ChannelRow[], direction: "outbound" | "inbound") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[#5D6D7E]">{title}</h3>
        {groupChannelsByPeer(rows, direction).map((group) => (
          <div key={`${direction}-${group.peerKey}`} className="space-y-2">
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
                    direction,
                    labelSat: satLabel,
                  })}
                  detail={`${c.fromSatelliteKey} → ${c.toSatelliteKey}`}
                  kindLabel={kindLabel(c.kind)}
                  flowBlurb={flowBlurb(c.kind)}
                  managedLabel={managedLabel(c.managedBy)}
                  enabled={c.enabled}
                  onLabel={t("channelsOn")}
                  offLabel={t("channelsOff")}
                  actionLabel={c.enabled ? t("channelsDisable") : t("channelsEnable")}
                  actionTone={c.enabled ? "danger" : "secondary"}
                  onAction={() => void toggleChannel(c.id, !c.enabled)}
                />
              ))}
            </ul>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("channelsEmpty")}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("channelsTitle")}
        subtitle={t("channelsHint")}
        actions={
          <button type="button" className={GHOST_BUTTON_CLASS} disabled={resyncing} onClick={() => void resyncChannels()}>
            {resyncing ? t("channelsResyncing") : t("channelsResync")}
          </button>
        }
      />
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} grid gap-4 p-4 lg:grid-cols-2`}>
        {column(t("channelsOutbound"), channelsOut, "outbound")}
        {column(t("channelsInbound"), channelsIn, "inbound")}
      </section>
    </div>
  );
}
