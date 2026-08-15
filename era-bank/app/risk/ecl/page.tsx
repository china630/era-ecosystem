"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { formatAznMajor } from "@/lib/bank-lookups";
import { useOpsMe } from "@/components/ops/useOpsMe";

type EclRun = {
  id: string;
  asOfDate?: string;
  totalEadMinor?: string | number;
  totalEclMinor?: string | number;
  provisionDeltaMinor?: string | number;
  status?: string;
  methodology?: string;
  note?: string | null;
  makerUserId?: string | null;
};

export default function RiskEclPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const me = useOpsMe();
  const canApprove = me?.canApprove === true;
  const [result, setResult] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<EclRun | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLast = useCallback(async () => {
    try {
      const res = await fetch("/api/risk/ecl/last", { cache: "no-store" });
      if (!res.ok) return;
      setLastRun((await res.json()) as EclRun | null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadLast();
  }, [loadLast]);

  async function runStaging() {
    setBusy(true);
    try {
      const res = await fetch("/api/risk/staging/run", { method: "POST" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      setResult(JSON.stringify(await res.json(), null, 2));
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  async function runEcl(methodology: "STAGE_FLAT" | "PD_LGD") {
    setBusy(true);
    try {
      const res = await fetch("/api/risk/ecl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runStagingFirst: true, methodology }),
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      setResult(JSON.stringify(await res.json(), null, 2));
      await loadLast();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  async function provisionAction(action: "provision-approve" | "provision-reject") {
    if (!lastRun?.id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/risk/ecl/${lastRun.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        showApiError(await res.text());
        return;
      }
      setResult(JSON.stringify(await res.json(), null, 2));
      await loadLast();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  const isMaker =
    Boolean(lastRun?.makerUserId) && me?.id === lastRun?.makerUserId;

  return (
    <div className="space-y-6">
      <PageHeader title={t("ecl")} subtitle={t("eclNote")} />
      <p className="text-sm text-amber-800 dark:text-amber-200">{t("labDisclaimer")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void runStaging()}
        >
          {t("runStaging")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void runEcl("STAGE_FLAT")}
        >
          {t("runEcl")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void runEcl("PD_LGD")}
        >
          {t("runEclPdLgd")}
        </button>
        {lastRun?.status === "PENDING_PROVISION_APPROVAL" &&
        canApprove &&
        !isMaker ? (
          <>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void provisionAction("provision-approve")}
            >
              {t("approveProvision")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void provisionAction("provision-reject")}
            >
              {t("rejectProvision")}
            </button>
          </>
        ) : null}
      </div>
      {lastRun ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">{t("lastEclRun")}</p>
          <p className="mt-1 text-muted-foreground">
            {String(lastRun.asOfDate ?? "").slice(0, 10)} · {lastRun.status} ·{" "}
            {lastRun.methodology} · {t("eclTotal")}:{" "}
            {formatAznMajor(String(lastRun.totalEclMinor ?? 0))} ·{" "}
            {t("provisionDelta")}:{" "}
            {formatAznMajor(String(lastRun.provisionDeltaMinor ?? 0))}
          </p>
          {lastRun.note ? (
            <p className="mt-2 text-xs text-muted-foreground">{lastRun.note}</p>
          ) : null}
        </div>
      ) : null}
      {result ? (
        <pre className="overflow-auto rounded border p-3 text-xs">{result}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">{t("eclPlaceholder")}</p>
      )}
    </div>
  );
}
