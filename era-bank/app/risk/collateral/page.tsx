"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { formatAznMinor } from "@/components/ops-ui";

type LoanRow = {
  loanId: string;
  customerId?: string;
  outstandingMinor?: string;
  collateral?: {
    description?: string;
    amountMinor?: string;
    type?: string;
  } | null;
};

type ItemRow = {
  id: string;
  ownerId?: string;
  type?: string;
  description?: string | null;
  valuationMinor?: string;
  haircutPct?: string;
  staleRevaluation?: boolean;
  valuationAsOf?: string;
};

export default function RiskCollateralPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRes, itemRes] = await Promise.all([
        fetch("/api/risk/collateral", { cache: "no-store" }),
        fetch("/api/risk/collateral-items", { cache: "no-store" }),
      ]);
      if (!loanRes.ok) {
        showApiError(tCommon("error"));
        setRows([]);
      } else {
        setRows((await loanRes.json()) as LoanRow[]);
      }
      if (itemRes.ok) {
        setItems((await itemRes.json()) as ItemRow[]);
      } else {
        setItems([]);
      }
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
      setItems([]);
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

  const itemGridRows = useMemo(
    () => items as Array<ItemRow & Record<string, unknown>>,
    [items],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("collateral")} subtitle={t("scaffoldNote")} />
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <>
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
          <h2 className="text-sm font-semibold">{t("itemsTitle")}</h2>
          <BankDataGrid
            columns={[
              {
                key: "id",
                header: t("colLoan"),
                render: (row) => String(row.id).slice(0, 12),
              },
              { key: "type", header: t("colType") },
              {
                key: "description",
                header: t("colDescription"),
                render: (row) => String(row.description ?? "—"),
              },
              {
                key: "valuationMinor",
                header: t("colCollateralValue"),
                render: (row) => formatAznMinor(row.valuationMinor),
              },
              {
                key: "haircutPct",
                header: t("colHaircut"),
                render: (row) => String(row.haircutPct ?? "0"),
              },
              {
                key: "staleRevaluation",
                header: t("colStale"),
                render: (row) =>
                  row.staleRevaluation ? t("staleYes") : "—",
              },
            ]}
            rows={itemGridRows}
            emptyLabel={tCommon("empty")}
          />
        </>
      )}
    </div>
  );
}
