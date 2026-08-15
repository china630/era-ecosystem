"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { OpsModalShell, useOpsModal } from "@/components/ops";
import { StatusBadge } from "@/components/ops-ui";

type Row = Record<string, unknown>;

export default function CollectionsPage() {
  const t = useTranslations("pages.collections");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/collections/cases", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows(await res.json());
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    try {
      const res = await fetch("/api/collections/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      close();
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: string, body?: Record<string, unknown>) {
    const res = await fetch(`/api/collections/cases/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) showApiError(tCommon("error"));
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => open("create")}>
            {t("create")}
          </button>
        }
      />
      <BankDataGrid
        rows={rows}
        emptyMessage={tCommon("empty")}
        columns={[
          {
            key: "id",
            header: t("colId"),
            render: (r: Row) => String(r.id ?? "").slice(0, 8),
          },
          {
            key: "loanId",
            header: t("colLoanId"),
            render: (r: Row) => String(r.loanId ?? ""),
          },
          {
            key: "outstandingMinor",
            header: t("colOutstandingMinor"),
            render: (r: Row) => String(r.outstandingMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) => (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "assign", { assigneeUserId: "collector-1" })
                  }
                >
                  Assign
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "ptp", {
                      amountMinor: String(r.outstandingMinor ?? "0"),
                      dueDate: new Date().toISOString(),
                    })
                  }
                >
                  PTP
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "recover", {
                      amountMinor: String(r.outstandingMinor ?? "0"),
                      checkerUserId: "checker-1",
                      idempotencyKey: `rec-${Date.now()}`,
                      branchId: "HQ",
                    })
                  }
                >
                  Recover
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    void act(String(r.id), "write-off", {
                      checkerUserId: "checker-1",
                    })
                  }
                >
                  Write-off
                </button>
              </div>
            ),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          <Field name="loanId" label={t("loanId")} preset="code" required />
          <Field name="customerId" label={t("customerId")} preset="code" required />
          <Field name="outstandingMinor" label={t("outstandingMinor")} preset="code" required />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={close}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {tCommon("save")}
            </button>
          </div>
        </form>
      </OpsModalShell>
    </div>
  );
}
