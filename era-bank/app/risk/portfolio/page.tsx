"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { formatAznMinor } from "@/components/ops-ui";

type Exposure = {
  id: string;
  customerId?: string;
  outstandingMinor?: string;
  ifrs9Stage?: number;
  daysPastDue?: number;
  isNpl?: boolean;
  akbScore?: number | null;
};

export default function RiskPortfolioPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<Exposure[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/risk/exposures", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Exposure[]);
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
    () => rows as Array<Exposure & Record<string, unknown>>,
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("portfolio")} subtitle={t("scaffoldNote")} />
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "id",
              header: t("colLoan"),
              render: (row) => String(row.id).slice(0, 12),
            },
            { key: "customerId", header: t("colCustomer") },
            {
              key: "outstandingMinor",
              header: t("outstanding"),
              render: (row) => formatAznMinor(row.outstandingMinor),
            },
            {
              key: "ifrs9Stage",
              header: t("colStage"),
              render: (row) => String(row.ifrs9Stage ?? 1),
            },
            {
              key: "daysPastDue",
              header: t("colDpd"),
              render: (row) => String(row.daysPastDue ?? 0),
            },
            {
              key: "isNpl",
              header: t("colNpl"),
              render: (row) => (row.isNpl ? "NPL" : "—"),
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
    </div>
  );
}
