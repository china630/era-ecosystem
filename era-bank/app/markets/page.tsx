"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";

type Row = Record<string, unknown>;

export default function MarketsPage() {
  const t = useTranslations("pages.markets");
  const tCommon = useTranslations("common");
  const [derivatives, setDerivatives] = useState<Row[]>([]);
  const [bonds, setBonds] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, bRes] = await Promise.all([
        fetch("/api/markets/derivatives", { cache: "no-store" }),
        fetch("/api/markets/bonds", { cache: "no-store" }),
      ]);
      const dData = dRes.ok ? await dRes.json() : [];
      const bData = bRes.ok ? await bRes.json() : [];
      setDerivatives(Array.isArray(dData) ? dData : []);
      setBonds(Array.isArray(bData) ? bData : []);
    } catch {
      setDerivatives([]);
      setBonds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = loading ? tCommon("loading") : tCommon("empty");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("derivatives")}</h2>
        <BankDataGrid
          rows={derivatives}
          emptyMessage={empty}
          columns={[
            {
              key: "contractRef",
              header: t("colRef"),
              render: (r: Row) => String(r.contractRef ?? ""),
            },
            {
              key: "productType",
              header: t("colType"),
              render: (r: Row) => String(r.productType ?? ""),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (r: Row) => String(r.status ?? ""),
            },
          ]}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("bonds")}</h2>
        <BankDataGrid
          rows={bonds}
          emptyMessage={empty}
          columns={[
            {
              key: "isin",
              header: t("colIsin"),
              render: (r: Row) => String(r.isin ?? ""),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (r: Row) => String(r.status ?? ""),
            },
          ]}
        />
      </section>
    </div>
  );
}
