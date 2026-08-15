"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { formatAznMajor } from "@/lib/bank-lookups";

type TrialRow = {
  glAccountId?: string;
  glCode?: string;
  name?: string;
  debitMinor?: unknown;
  creditMinor?: unknown;
  debit?: number;
  credit?: number;
};

function toMinor(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function ExecutiveDashboardPage() {
  const t = useTranslations("pages.executive");
  const tGl = useTranslations("pages.gl");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gl/trial-balance?date=${today}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          showApiError(tCommon("error"));
          setRows([]);
          return;
        }
        const data = await r.json();
        if (Array.isArray(data)) setRows(data as TrialRow[]);
        else setRows([]);
      })
      .catch(() => {
        showApiError(tCommon("error"));
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [today, tCommon]);

  const gridRows = useMemo(
    () =>
      rows.map((row, i) => {
        const debit = toMinor(row.debit ?? row.debitMinor);
        const credit = toMinor(row.credit ?? row.creditMinor);
        return {
          id: row.glAccountId ?? row.glCode ?? String(i),
          glCode: row.glCode ?? row.glAccountId ?? "—",
          name: row.name ?? "",
          debit,
          credit,
          balance: debit - credit,
        };
      }) as Array<Record<string, unknown>>,
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            { key: "glCode", header: tGl("colCode") },
            { key: "name", header: tGl("colName") },
            {
              key: "debit",
              header: tGl("colDebit"),
              render: (row) => formatAznMajor(Number(row.debit ?? 0)),
            },
            {
              key: "credit",
              header: tGl("colCredit"),
              render: (row) => formatAznMajor(Number(row.credit ?? 0)),
            },
            {
              key: "balance",
              header: tGl("colBalance"),
              render: (row) => formatAznMajor(Number(row.balance ?? 0)),
            },
          ]}
          rows={gridRows}
          emptyLabel={t("empty")}
        />
      )}
    </div>
  );
}
