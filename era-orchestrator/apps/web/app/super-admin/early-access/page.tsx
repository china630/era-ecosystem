"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { SuperAdminDataTable } from "../../../components/super-admin-data-table";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

type ModuleSummary = {
  moduleKey: string;
  signupsCount: number;
  viewersCount: number;
  conversionRate: number;
  medianModalCloseMs: number | null;
  signupsPerHour: number;
  speedRank: number;
};

export default function SuperAdminEarlyAccessPage() {
  const t = useTranslations("superAdmin.earlyAccess");
  const [summary, setSummary] = useState<ModuleSummary[]>([]);
  const [events, setEvents] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setSummaryLoading(true);
      const [sRes, eRes] = await Promise.all([
        cpAdminFetch("early-access/summary"),
        cpAdminFetch("early-access/events?page=1&pageSize=50"),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setSummary(Array.isArray(data) ? (data as ModuleSummary[]) : []);
      }
      setSummaryLoading(false);
      if (eRes.ok) {
        const data = (await eRes.json()) as { items?: Array<Record<string, string>> };
        setEvents(data.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const totalSignups = summary.reduce((s, m) => s + m.signupsCount, 0);
  const totalViewers = summary.reduce((s, m) => s + m.viewersCount, 0);
  const activeModules = summary.filter((m) => m.signupsCount > 0).length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("totalSignups")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#34495E]">
            {summaryLoading ? "…" : totalSignups}
          </p>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("totalViewers")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#34495E]">
            {summaryLoading ? "…" : totalViewers}
          </p>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("activeModules")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#34495E]">
            {summaryLoading ? "…" : activeModules}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium text-[#34495E]">{t("byModule")}</h2>
        <SuperAdminDataTable
          loading={summaryLoading}
          loadingLabel={t("loadingSummary")}
          columns={["moduleKey", "signupsCount", "viewersCount", "conversion", "medianSec", "speedRank"]}
          headers={{
            moduleKey: t("colModule"),
            signupsCount: t("colSignups"),
            viewersCount: t("colViewers"),
            conversion: t("colConversion"),
            medianSec: t("colMedian"),
            speedRank: t("colRank"),
          }}
          rows={[...summary]
            .sort((a, b) => a.speedRank - b.speedRank)
            .map((m) => ({
              moduleKey: m.moduleKey,
              signupsCount: m.signupsCount,
              viewersCount: m.viewersCount,
              conversion: `${Math.round(m.conversionRate * 100)}%`,
              medianSec:
                m.medianModalCloseMs != null ? `${(m.medianModalCloseMs / 1000).toFixed(1)}s` : "—",
              speedRank: m.speedRank || "—",
            }))}
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium text-[#34495E]">{t("recentEvents")}</h2>
        <SuperAdminDataTable
          loading={loading}
          columns={["moduleKey", "eventType", "organizationId", "createdAt"]}
          headers={{
            moduleKey: t("colModule"),
            eventType: t("colEvent"),
            organizationId: t("colOrg"),
            createdAt: t("colCreated"),
          }}
          rows={events.map((e) => ({
            moduleKey: e.moduleKey ?? "",
            eventType: e.eventType ?? "",
            organizationId: e.organizationId ?? "",
            createdAt: e.createdAt ?? "",
          }))}
        />
      </div>
    </div>
  );
}
