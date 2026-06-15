"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, OpsResult, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type AmlAlert = {
  id: string;
  status?: string;
  severity?: string;
  ruleCode?: string;
  narrative?: string;
  amountMinor?: unknown;
  currency?: string;
  resolutionNote?: string | null;
};

function AmlAlertsPageInner() {
  const t = useTranslations("pages.aml");
  const tCommon = useTranslations("common");
  const { mode, entityId, open, close, isOpen } = useOpsModal();
  const [rows, setRows] = useState<AmlAlert[]>([]);
  const [detail, setDetail] = useState<AmlAlert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [actionResult, setActionResult] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/aml/alerts", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as AmlAlert[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  const loadDetail = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/aml/alerts/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      const data = (await res.json()) as AmlAlert;
      setDetail(data);
      setNote(data.resolutionNote ?? "");
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "detail" && entityId) {
      void loadDetail(entityId);
    } else {
      setDetail(null);
      setActionResult("");
    }
  }, [mode, entityId, loadDetail]);

  async function patchStatus(status: string) {
    if (!entityId) return;
    setBusy(true);
    setActionResult("");
    try {
      const res = await fetch(`/api/aml/alerts/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: note || undefined }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (!entityId) return;
    setBusy(true);
    setActionResult("");
    try {
      const res = await fetch(`/api/aml/alerts/${entityId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote: note || undefined }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
        <Link href="/aml/screen" className="text-sm text-primary underline">
          Manual screening
        </Link>
        <Link href="/aml/reports/fmn" className="text-sm text-primary underline">
          FMN report
        </Link>
        <Link href="/aml/rules" className="text-sm text-primary underline">
          AML rules
        </Link>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel={tCommon("empty")}
          onRowClick={(row) => open("detail", row.id)}
          columns={[
            {
              key: "id",
              label: "ID",
              render: (row) => `${row.id.slice(0, 10)}…`,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
            { key: "severity", label: "Severity" },
            { key: "ruleCode", label: "Rule" },
            {
              key: "amountMinor",
              label: "Amount",
              render: (row) => formatAznMinor(row.amountMinor),
            },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="AML alert"
        subtitle={entityId ?? undefined}
        onClose={close}
        hideFooter
        maxWidthClass="max-w-2xl"
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{detail.status ? <StatusBadge status={detail.status} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Severity</dt>
                <dd>{detail.severity ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rule</dt>
                <dd>{detail.ruleCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd>{formatAznMinor(detail.amountMinor)}</dd>
              </div>
            </dl>
            <p className="rounded bg-muted/40 p-3 text-[13px]">{detail.narrative ?? "—"}</p>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Resolution note</span>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void patchStatus("UNDER_REVIEW")}
              >
                Under review
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void patchStatus("CLOSED")}
              >
                Close
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void escalate()}
              >
                Escalate
              </button>
            </div>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
        )}
      </OpsModalShell>
    </div>
  );
}

export default function AmlAlertsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <AmlAlertsPageInner />
    </Suspense>
  );
}
