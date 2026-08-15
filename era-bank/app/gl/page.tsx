"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { formatAznMajor } from "@/lib/bank-lookups";

type GlRow = {
  id?: string;
  code?: string;
  name?: string;
  debitMinor?: string | number;
  creditMinor?: string | number;
  balanceMinor?: string | number;
};

export default function GlPage() {
  const t = useTranslations("pages.gl");
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<GlRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gl/trial-balance", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = (await res.json()) as
        | GlRow[]
        | { rows?: GlRow[]; accounts?: GlRow[] };
      const list = Array.isArray(data)
        ? data
        : (data.rows ?? data.accounts ?? []);
      setRows(list);
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

  const filtered = rows.filter((r) => {
    if (!debouncedQ.trim()) return true;
    const hay = `${r.code ?? ""} ${r.name ?? ""} ${r.id ?? ""}`.toLowerCase();
    return hay.includes(debouncedQ.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => setQ("")}
      >
        <Field
          label={t("searchLabel")}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "code",
              header: t("colCode"),
              render: (row) => String(row.code ?? row.id ?? "—"),
            },
            {
              key: "name",
              header: t("colName"),
              render: (row) => String(row.name ?? "—"),
            },
            {
              key: "debit",
              header: t("colDebit"),
              render: (row) => formatAznMajor(row.debitMinor),
            },
            {
              key: "credit",
              header: t("colCredit"),
              render: (row) => formatAznMajor(row.creditMinor),
            },
            {
              key: "balance",
              header: t("colBalance"),
              render: (row) => formatAznMajor(row.balanceMinor),
            },
          ]}
          rows={filtered as Array<GlRow & Record<string, unknown>>}
          rowKey={(r) => String(r.id ?? r.code ?? Math.random())}
          emptyMessage={tCommon("empty")}
        />
      )}
    </div>
  );
}
