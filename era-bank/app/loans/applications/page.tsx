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

export default function LoanApplicationsPage() {
  const t = useTranslations("pages.loanApps");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loans/applications", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
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
    const body = {
      customerId: String(form.get("customerId") ?? ""),
      productTemplateId: String(form.get("productTemplateId") ?? ""),
      requestedMinor: String(form.get("requestedMinor") ?? ""),
      currency: String(form.get("currency") ?? "AZN"),
    };
    try {
      const res = await fetch("/api/loans/applications", {
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

  async function act(id: string, action: "submit" | "approve") {
    const res = await fetch(`/api/loans/applications/${id}/${action}`, {
      method: "POST",
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
            key: "customerId",
            header: t("colCustomerId"),
            render: (r: Row) => String(r.customerId ?? ""),
          },
          {
            key: "requestedMinor",
            header: t("colRequestedMinor"),
            render: (r: Row) => String(r.requestedMinor ?? ""),
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
              <div className="flex gap-1">
                {r.status === "DRAFT" ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void act(String(r.id), "submit")}
                  >
                    Submit
                  </button>
                ) : null}
                {r.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void act(String(r.id), "approve")}
                  >
                    Book (SoD)
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          <Field name="customerId" label={t("customerId")} preset="code" required />
          <Field name="productTemplateId" label={t("productTemplateId")} preset="code" required />
          <Field name="requestedMinor" label={t("requestedMinor")} preset="code" required />
          <Field name="currency" label={t("currency")} preset="code" defaultValue="AZN" />
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
