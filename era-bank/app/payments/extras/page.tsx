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
type Tab = "so" | "va" | "cheques" | "sweep";

export default function PaymentsExtrasPage() {
  const t = useTranslations("pages.paymentsExtras");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("so");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "so"
      ? "/api/payments/standing-orders"
      : tab === "va"
        ? "/api/payments/virtual-accounts"
        : tab === "cheques"
          ? "/api/payments/cheques"
          : "/api/payments/sweep-rules";

  const load = useCallback(async () => {
    setLoading(true);
    try {
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
  }, [endpoint, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    if (!body.idempotencyKey) body.idempotencyKey = `ui-so-${Date.now()}`;
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
      <div className="flex gap-2">
        {(["so", "va", "cheques", "sweep"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {t(`tab_${k}`)}
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
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "")} />,
          },
          {
            key: "detail",
            header: t("colDetail"),
            render: (r: Row) =>
              String(r.toIban ?? r.virtualIban ?? r.chequeNumber ?? r.masterAccountId ?? ""),
          },
        ]}
      />
      <OpsModalShell open={mode === "create"} onClose={close} title={t("createTitle")}>
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "so" && (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="fromAccountId" label={t("fromAccountId")} preset="code" required />
              <Field name="toIban" label={t("toIban")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="nextRunAt" label={t("nextRunAt")} preset="code" required />
              <Field name="idempotencyKey" label={t("idempotencyKey")} preset="code" />
            </>
          )}
          {tab === "va" && (
            <>
              <Field name="customerId" label={t("customerId")} preset="code" required />
              <Field name="parentAccountId" label={t("parentAccountId")} preset="code" required />
              <Field name="virtualIban" label={t("virtualIban")} preset="code" required />
            </>
          )}
          {tab === "cheques" && (
            <>
              <Field name="accountId" label={t("accountId")} preset="code" required />
              <Field name="chequeNumber" label={t("chequeNumber")} preset="code" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="payeeName" label={t("payeeName")} preset="shortText" required />
            </>
          )}
          {tab === "sweep" && (
            <>
              <Field name="masterAccountId" label={t("masterAccountId")} preset="code" required />
              <Field name="childAccountId" label={t("childAccountId")} preset="code" required />
              <Field name="targetMinor" label={t("targetMinor")} preset="code" />
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
