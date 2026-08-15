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
type Tab = "lc" | "guarantees" | "dc" | "scf" | "swift";

export default function TradePage() {
  const t = useTranslations("pages.trade");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("lc");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "lc"
      ? "/api/trade/lc"
      : tab === "guarantees"
        ? "/api/trade/guarantees"
        : tab === "dc"
          ? "/api/trade/dc"
          : tab === "scf"
            ? "/api/trade/scf"
            : "/api/trade/swift";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "swift") {
        setRows([]);
        return;
      }
      const res = await fetch(endpoint, { cache: "no-store" });
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
  }, [endpoint, tCommon, tab]);

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
      const res = await fetch(endpoint, {
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
      <div className="flex flex-wrap gap-2">
        {(["lc", "guarantees", "dc", "scf", "swift"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {k.toUpperCase()}
            {k === "swift" ? " (stub)" : ""}
          </button>
        ))}
      </div>
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
            key: "reference",
            header: t("colReference"),
            render: (r: Row) => String(r.reference ?? r.messageType ?? ""),
          },
          {
            key: "amountMinor",
            header: t("colAmountMinor"),
            render: (r: Row) => String(r.amountMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "actions",
            header: tCommon("actions"),
            render: (r: Row) =>
              tab === "lc" && r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(`/api/trade/lc/${String(r.id)}/issue`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        branchId: "HQ",
                        idempotencyKey: `lc-issue-${Date.now()}`,
                      }),
                    }).then(() => load());
                  }}
                >
                  {t("issue")}
                </button>
              ) : tab === "swift" && r.status === "DRAFT" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(`/api/trade/swift/${String(r.id)}/submit`, {
                      method: "POST",
                    }).then(() => load());
                  }}
                >
                  Submit stub
                </button>
              ) : null,
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "swift" ? (
            <>
              <Field name="messageType" label="MT type" preset="code" defaultValue="MT700" required />
              <Field name="payload" label="Payload" preset="shortText" required />
            </>
          ) : (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="reference" label={t("reference")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              {tab === "lc" ? (
                <Field name="direction" label={t("direction")} preset="code" defaultValue="IMPORT" />
              ) : null}
              <Field name="beneficiaryName" label={t("beneficiaryName")} preset="shortText" />
            </>
          )}
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
