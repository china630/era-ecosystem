"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";

type AuditRow = {
  id: string;
  action: string;
  refType?: string | null;
  refId?: string | null;
  at: string;
  opsUser: string;
  fullName: string;
};

export default function OpsAuditPage() {
  const t = useTranslations("pages.audit");
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = (await res.json()) as AuditRow[];
      const needle = debouncedQ.trim().toLowerCase();
      setRows(
        needle
          ? data.filter(
              (r) =>
                r.action.toLowerCase().includes(needle) ||
                r.fullName.toLowerCase().includes(needle) ||
                (r.refType ?? "").toLowerCase().includes(needle),
            )
          : data,
      );
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        refLabel: `${r.refType ?? "—"} ${r.refId ? `/ ${r.refId.slice(0, 8)}` : ""}`,
      })) as Array<AuditRow & { refLabel: string } & Record<string, unknown>>,
    [rows],
  );

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
          placeholder={t("searchPlaceholder")}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "at",
              header: t("colTime"),
              render: (row) => new Date(String(row.at)).toLocaleString(),
            },
            { key: "fullName", header: t("colUser") },
            {
              key: "action",
              header: t("colAction"),
              render: (row) => (
                <span className="font-mono text-[11px]">{String(row.action)}</span>
              ),
            },
            { key: "refLabel", header: t("colRef") },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
    </div>
  );
}
