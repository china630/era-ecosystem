"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { OpsModalShell, useEodLock } from "@/components/ops";
import { StatusBadge } from "@/components/ops-ui";

type EodRun = {
  status?: string;
  businessDate?: string;
  stepsJson?: Record<string, unknown> & {
    trialBalance?: { balanced?: boolean; totalDebit?: number; totalCredit?: number };
    depositInterestAccrual?: unknown;
    lcr?: unknown;
    floatingRateReset?: unknown;
  };
};

export default function EodAdminPage() {
  const t = useTranslations("pages.eod");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const today = new Date().toISOString().slice(0, 10);
  const [businessDate, setBusinessDate] = useState(today);
  const [run, setRun] = useState<EodRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/eod/${businessDate}`, { cache: "no-store" });
      if (res.status === 404) {
        setRun(null);
        return;
      }
      if (!res.ok) {
        showApiError(tCommon("error"));
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRun((await res.json()) as EodRun);
    } catch {
      showApiError(tCommon("error"));
      setError(tCommon("error"));
    }
  }, [businessDate, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runEod() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/eod/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `eod-${businessDate}`,
        },
        body: JSON.stringify({ businessDate }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setRun((await res.json()) as EodRun);
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const tb = run?.stepsJson?.trialBalance;
  const steps = run?.stepsJson;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} grid gap-4 sm:grid-cols-2`}>
        <Field
          label={t("businessDate")}
          preset="date"
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || mutationsDisabled}
            onClick={() => setConfirmOpen(true)}
          >
            {t("run")}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className={CARD_CONTAINER_CLASS}>
        <h3 className="mb-2 font-medium">{t("status")}</h3>
        {run?.status ? (
          <StatusBadge status={run.status} />
        ) : (
          <span className="text-sm text-muted-foreground">{t("notRun")}</span>
        )}
        {tb ? (
          <div className="mt-4 text-sm">
            <p>
              {t("trialBalance")}: {tb.balanced ? t("balanced") : t("unbalanced")}
            </p>
            <p>
              {t("debitLabel")}: {tb.totalDebit ?? 0} / {t("creditLabel")}:{" "}
              {tb.totalCredit ?? 0}
            </p>
          </div>
        ) : null}
        {steps ? (
          <div className="mt-4 space-y-2 text-sm">
            {steps.depositInterestAccrual != null ? (
              <div>
                <p className="font-medium">{t("stepDepositAccrual")}</p>
                <pre className="overflow-auto text-xs">
                  {JSON.stringify(steps.depositInterestAccrual, null, 2)}
                </pre>
              </div>
            ) : null}
            {steps.lcr != null ? (
              <div>
                <p className="font-medium">{t("stepLcr")}</p>
                <pre className="overflow-auto text-xs">
                  {JSON.stringify(steps.lcr, null, 2)}
                </pre>
              </div>
            ) : null}
            {steps.floatingRateReset != null ? (
              <div>
                <p className="font-medium">{t("stepFloatingReset")}</p>
                <pre className="overflow-auto text-xs">
                  {JSON.stringify(steps.floatingRateReset, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <OpsModalShell
        open={confirmOpen}
        title={t("runConfirmTitle")}
        subtitle={t("runConfirmSubtitle")}
        onClose={() => setConfirmOpen(false)}
        onSubmit={() => void runEod()}
        submitLabel={t("runConfirm")}
        busy={busy}
      >
        <p className="text-sm text-muted-foreground">{t("businessDate")}: {businessDate}</p>
      </OpsModalShell>
    </div>
  );
}
