"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { bakuDateDisplay } from "@era/satellite-kit/time";
import { formatAznMinor } from "@/components/ops-ui";

const SYSTEM_MAKERS = new Set([
  "risk-system",
  "service",
  "eod-system",
  "system",
]);

type PrudentialRun = {
  id: string;
  asOfDate?: string;
  status?: string;
  makerUserId?: string;
  totalOutstandingMinor?: string;
  totalProvisionMinor?: string;
  provisionDeltaMinor?: string;
  results?: Array<{
    loanId: string;
    category: string;
    dpd: number;
    provisionMinor: string;
  }>;
};

export default function PrudentialPage() {
  const t = useTranslations("pages.riskPrudential");
  const tCommon = useTranslations("common");
  const [last, setLast] = useState<PrudentialRun | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/risk/prudential/last", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      setLast((await res.json()) as PrudentialRun | null);
    } catch {
      showApiError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run() {
    const res = await fetch("/api/risk/prudential/run", { method: "POST" });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    setLast((await res.json()) as PrudentialRun);
  }

  async function approve() {
    if (!last?.id) return;
    const res = await fetch(`/api/risk/prudential/${last.id}/provision-approve`, {
      method: "POST",
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  async function writeOffUmidsiz(loanId: string) {
    let makerUserId = last?.makerUserId?.trim() || "";
    if (!makerUserId || SYSTEM_MAKERS.has(makerUserId)) {
      const typed = window.prompt(t("makerPrompt"));
      makerUserId = typed?.trim() || "";
      if (!makerUserId || SYSTEM_MAKERS.has(makerUserId)) {
        showApiError(t("makerRequired"));
        return;
      }
    }
    const res = await fetch(`/api/risk/prudential/loans/${loanId}/write-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ makerUserId }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void run()}>
              {t("run")}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
              {tCommon("refresh")}
            </button>
          </div>
        }
      />
      {!last ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              {t("asOf")}:{" "}
              {last.asOfDate ? bakuDateDisplay(last.asOfDate) : "—"}
            </div>
            <div>
              {t("status")}: {last.status}
            </div>
            <div>
              {t("outstanding")}: {formatAznMinor(last.totalOutstandingMinor)}
            </div>
            <div>
              {t("provision")}: {formatAznMinor(last.totalProvisionMinor)}
            </div>
            <div>
              {t("delta")}: {formatAznMinor(last.provisionDeltaMinor)}
            </div>
          </div>
          {String(last.status).includes("PENDING") ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void approve()}>
              {t("approve")}
            </button>
          ) : null}
          <ul className="space-y-1 text-sm">
            {(last.results ?? []).slice(0, 50).map((r) => (
              <li
                key={r.loanId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-1"
              >
                <span>
                  {r.loanId} · {r.category} · DPD {r.dpd} ·{" "}
                  {formatAznMinor(r.provisionMinor)}
                </span>
                {String(r.category).toUpperCase() === "UMIDSIZ" &&
                !String(last.status).includes("PENDING") ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void writeOffUmidsiz(r.loanId)}
                  >
                    {t("writeOff")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
