"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";

async function downloadExport(path: string, filename: string) {
  const token = getOrchAccessToken();
  const res = await fetch(`/api/platform/workforce/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WorkforceExportPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceExport");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = now.toISOString().slice(0, 10);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-4 text-sm">
        <Link href="/workspace/workforce/employments" className="text-[#2980B9] hover:underline">
          ← {t("back")}
        </Link>
      </p>
      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("rosterTitle")}</h2>
          <p className="mt-1 text-xs text-[#7F8C8D]">{t("rosterHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-4`}
            disabled={busy === "roster"}
            onClick={() =>
              void run("roster", () =>
                downloadExport("export/roster?format=csv", "workforce-roster.csv"),
              )
            }
          >
            {busy === "roster" ? t("downloading") : t("downloadRoster")}
          </button>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("absencesTitle")}</h2>
          <p className="mt-1 text-xs text-[#7F8C8D]">{t("absencesHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-4`}
            disabled={busy === "absences"}
            onClick={() =>
              void run("absences", () =>
                downloadExport(
                  `export/absences?from=${from}&to=${to}`,
                  "workforce-absences.csv",
                ),
              )
            }
          >
            {busy === "absences" ? t("downloading") : t("downloadAbsences")}
          </button>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("timesheetTitle")}</h2>
          <p className="mt-1 text-xs text-[#7F8C8D]">{t("timesheetHint")}</p>
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} mt-4`}
            disabled={busy === "timesheet"}
            onClick={() =>
              void run("timesheet", () =>
                downloadExport(
                  `export/timesheet?year=${year}&month=${month}`,
                  `workforce-timesheet-${year}-${String(month).padStart(2, "0")}.csv`,
                ),
              )
            }
          >
            {busy === "timesheet" ? t("downloading") : t("downloadTimesheet")}
          </button>
        </div>
      </div>
    </>
  );
}
