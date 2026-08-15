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
type Tab = "tariffs" | "sdb" | "packages";

export default function FeesPage() {
  const t = useTranslations("pages.fees");
  const tCommon = useTranslations("common");
  const { mode, open, close } = useOpsModal();
  const [tab, setTab] = useState<Tab>("tariffs");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const endpoint =
    tab === "tariffs"
      ? "/api/fees/tariffs"
      : tab === "sdb"
        ? "/api/fees/safe-deposit-boxes"
        : "/api/fees/packages";

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
    const body: Record<string, string | number> = {};
    for (const [k, v] of form.entries()) body[k] = String(v);
    try {
      const postUrl =
        tab === "packages" && mode === "linkTariff"
          ? `/api/fees/packages/${body.packageId}/tariffs`
          : endpoint;
      const res = await fetch(postUrl, {
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
          <div className="flex gap-2">
            {tab === "packages" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => open("linkTariff")}
              >
                {t("linkTariff")}
              </button>
            ) : null}
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => open("create")}>
              {t("create")}
            </button>
          </div>
        }
      />
      <div className="flex gap-2">
        {(["tariffs", "sdb", "packages"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(k)}
          >
            {k}
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
            render: (r: Row) => String(r.id ?? r.code ?? "").slice(0, 12),
          },
          {
            key: "name",
            header: t("colName"),
            render: (r: Row) => String(r.name ?? r.boxNumber ?? ""),
          },
          {
            key: "amountMinor",
            header: t("colAmountMinor"),
            render: (r: Row) => String(r.amountMinor ?? r.rentMinor ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => <StatusBadge status={String(r.status ?? "ACTIVE")} />,
          },
        ]}
      />
      <OpsModalShell
        open={mode === "create" || mode === "linkTariff"}
        onClose={close}
        title={mode === "linkTariff" ? t("linkTariffTitle") : t("createTitle")}
      >
        <form className="space-y-3" onSubmit={onCreate}>
          {tab === "tariffs" && mode === "create" && (
            <>
              <Field name="code" label={t("code")} preset="code" required />
              <Field name="name" label={t("name")} preset="shortText" required />
              <Field name="amountMinor" label={t("amountMinor")} preset="code" required />
              <Field name="currency" label={t("currency")} preset="code" defaultValue="AZN" />
            </>
          )}
          {tab === "sdb" && mode === "create" && (
            <>
              <Field name="branchId" label={t("branchId")} preset="code" required />
              <Field name="boxNumber" label="boxNumber" preset="code" required />
              <Field name="rentMinor" label="rentMinor" preset="code" required />
            </>
          )}
          {tab === "packages" && mode === "create" && (
            <>
              <Field name="code" label={t("code")} preset="code" required />
              <Field name="name" label={t("name")} preset="shortText" required />
            </>
          )}
          {tab === "packages" && mode === "linkTariff" && (
            <>
              <Field name="packageId" label={t("packageId")} preset="code" required />
              <Field name="tariffCode" label={t("tariffCode")} preset="code" required />
              <Field name="waiverType" label={t("waiverType")} preset="code" defaultValue="PERCENT" required />
              <Field name="waiverValue" label={t("waiverValue")} preset="code" defaultValue="25" />
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
