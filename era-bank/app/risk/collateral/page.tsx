"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { formatAznMinor } from "@/components/ops-ui";

type Row = {
  loanId: string;
  customerId?: string;
  outstandingMinor?: string;
  collateral?: {
    description?: string;
    amountMinor?: string;
    type?: string;
  } | null;
};

export default function RiskCollateralPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/risk/collateral", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Row[]);
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

  const gridRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        description: r.collateral?.description ?? "—",
        amountMinor: r.collateral?.amountMinor ?? "0",
        type: r.collateral?.type ?? "—",
      })) as Array<Record<string, unknown>>,
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("collateral")} subtitle={t("scaffoldNote")} />
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "loanId",
              header: t("colLoan"),
              render: (row) => String(row.loanId).slice(0, 12),
            },
            { key: "customerId", header: t("colCustomer") },
            { key: "description", header: t("colDescription") },
            { key: "type", header: t("colType") },
            {
              key: "amountMinor",
              header: t("colCollateralValue"),
              render: (row) => formatAznMinor(row.amountMinor),
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
    </div>
  );
}
