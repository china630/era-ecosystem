"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";

type Row = Record<string, unknown>;

export default function AtmPage() {
  const t = useTranslations("pages.atm");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atm/terminals", { cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <BankDataGrid
        rows={rows}
        emptyMessage={loading ? tCommon("loading") : tCommon("empty")}
        columns={[
          {
            key: "terminalId",
            header: t("colTerminal"),
            render: (r: Row) => String(r.terminalId ?? ""),
          },
          {
            key: "locationName",
            header: t("colLocation"),
            render: (r: Row) => String(r.locationName ?? ""),
          },
          {
            key: "status",
            header: t("colStatus"),
            render: (r: Row) => String(r.status ?? ""),
          },
        ]}
      />
    </div>
  );
}
