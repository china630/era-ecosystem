"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { useOpsModal } from "@/components/ops";
import { BranchCreateModal } from "@/components/ops/modals/BranchModals";

type Branch = {
  id: string;
  code?: string;
  name?: string;
  status?: string;
  isHeadOffice?: boolean;
};

function BranchesAdminPageContent() {
  const t = useTranslations("pages.branches");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/branches", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = (await res.json()) as Branch[];
      const needle = debouncedQ.trim().toLowerCase();
      setRows(
        needle
          ? data.filter(
              (r) =>
                (r.code ?? "").toLowerCase().includes(needle) ||
                (r.name ?? "").toLowerCase().includes(needle) ||
                r.id.toLowerCase().includes(needle),
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
    () => rows as Array<Branch & Record<string, unknown>>,
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => modal.open("create")}
          >
            {t("create")}
          </button>
        }
      />
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
            { key: "code", header: t("colCode") },
            { key: "name", header: t("colName") },
            {
              key: "isHeadOffice",
              header: t("colHeadOffice"),
              render: (row) => (row.isHeadOffice ? t("yes") : t("no")),
            },
            {
              key: "id",
              header: t("colId"),
              render: (row) => (
                <span className="font-mono text-[11px]">{row.id}</span>
              ),
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
      <BranchCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={() => void load()}
      />
    </div>
  );
}

export default function BranchesAdminPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <BranchesAdminPageContent />
    </Suspense>
  );
}
