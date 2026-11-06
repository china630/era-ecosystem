"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SatelliteAdminLinksPanels,
  type SatelliteAdminLinksChannelRow,
  type SatelliteAdminLinksLabels,
  type SatelliteAdminLinksMode,
} from "@era/satellite-kit/ui";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../lib/role-utils";

export default function AdminLinksPage() {
  const { t } = useTranslation();
  const { ready, token } = useAuth();
  const perms = useOrgPermissions();
  const canManage =
    perms.canAccessBilling || perms.can(CP_PERMISSION.API_BILLING_MANAGE);
  const [outbound, setOutbound] = useState<SatelliteAdminLinksChannelRow[]>([]);
  const [inbound, setInbound] = useState<SatelliteAdminLinksChannelRow[]>([]);
  const [mode, setMode] = useState<SatelliteAdminLinksMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const labels: SatelliteAdminLinksLabels = useMemo(
    () => ({
      title: t("adminLinks.title", { defaultValue: "Integration links" }),
      subtitle: t("adminLinks.subtitle", {
        defaultValue: "Money routing and peer channels for this organization.",
      }),
      loadFailed: t("adminLinks.loadFailed", {
        defaultValue: "Could not load links",
      }),
      saveFailed: t("adminLinks.saveFailed", {
        defaultValue: "Could not update channel",
      }),
      loading: t("adminLinks.loading", { defaultValue: "Loading…" }),
      moneyTitle: t("adminLinks.moneyTitle", { defaultValue: "Money routing" }),
      moneyLine: (vars) =>
        t("adminLinks.moneyLine", {
          defaultValue: `Mode ${vars.mode} · fiscal ${vars.fiscal} · revenue ${vars.revenue}`,
          ...vars,
        }),
      moneyUnknown: t("adminLinks.moneyUnknown", {
        defaultValue: "Operating mode unavailable",
      }),
      outbound: t("adminLinks.outbound", { defaultValue: "Outbound" }),
      inbound: t("adminLinks.inbound", { defaultValue: "Inbound" }),
      empty: t("adminLinks.empty", { defaultValue: "No channels" }),
      on: t("adminLinks.on", { defaultValue: "on" }),
      off: t("adminLinks.off", { defaultValue: "off" }),
      disable: t("adminLinks.disable", { defaultValue: "Disable inbound" }),
      satHotel: t("adminLinks.satHotel", { defaultValue: "Hotel" }),
      satClinic: t("adminLinks.satClinic", { defaultValue: "Clinic" }),
      satFnb: t("adminLinks.satFnb", { defaultValue: "F&B" }),
      satRetail: t("adminLinks.satRetail", { defaultValue: "Retail" }),
      satFinance: t("adminLinks.satFinance", { defaultValue: "Finance" }),
      kindFolio: t("adminLinks.kindFolio", { defaultValue: "Folio post" }),
      kindSettlement: t("adminLinks.kindSettlement", {
        defaultValue: "Settlement",
      }),
      kindRevenue: t("adminLinks.kindRevenue", {
        defaultValue: "Revenue event",
      }),
      kindRead: t("adminLinks.kindRead", { defaultValue: "Read status" }),
      kindOpsHandoff: t("adminLinks.kindOpsHandoff", {
        defaultValue: "Ops handoff",
      }),
      managedPlatform: t("adminLinks.managedPlatform", {
        defaultValue: "Platform",
      }),
      managedAcceptor: t("adminLinks.managedAcceptor", {
        defaultValue: "Acceptor",
      }),
      legacyTitle: t("adminLinks.legacyTitle", {
        defaultValue: "Legacy bridges",
      }),
      legacyHint: t("adminLinks.legacyHint", {
        defaultValue:
          "Display-only CODE_LEGACY hints — not live channel gates.",
      }),
    }),
    [t],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await apiFetch("/api/integration/channels");
    setLoading(false);
    if (!res.ok) {
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
  }, [labels.loadFailed, token]);

  useEffect(() => {
    if (!ready || !token || !canManage) return;
    void load();
  }, [ready, token, canManage, load]);

  async function onDisableInbound(channelId: string) {
    const res = await apiFetch(`/api/integration/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    if (!res.ok) {
      setError(labels.saveFailed);
      return;
    }
    await load();
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <PageHeader
          title={labels.title}
          subtitle={t("adminLinks.forbidden", {
            defaultValue: "Billing manage permission required.",
          })}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <PageHeader title={labels.title} subtitle={labels.subtitle} />
      </div>
      <SatelliteAdminLinksPanels
        labels={labels}
        outbound={outbound}
        inbound={inbound}
        mode={mode}
        error={error}
        loading={loading}
        onDisableInbound={onDisableInbound}
        showHeader={false}
      />
    </div>
  );
}
