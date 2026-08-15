"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { useOpsModal } from "@/components/ops";
import { CifCreateModal, CifDetailModal } from "@/components/ops/modals/CifModals";
import { StatusBadge } from "@/components/ops-ui";

type Customer = {
  id: string;
  customerType?: string;
  kycStatus?: string;
  status?: string;
  voen?: string | null;
  globalPersonId?: string | null;
  homeBranchId?: string;
};

function CifPageContent() {
  const t = useTranslations("pages.cif");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = debouncedQ.trim()
        ? `?q=${encodeURIComponent(debouncedQ.trim())}`
        : "";
      const res = await fetch(`/api/cif/customers${qs}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Customer[]);
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
    () => rows as Array<Customer & Record<string, unknown>>,
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
              key: "id",
              header: t("colId"),
              render: (row) => (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => modal.open("detail", row.id)}
                >
                  {row.id.slice(0, 12)}…
                </button>
              ),
            },
            { key: "customerType", header: t("colType") },
            {
              key: "kycStatus",
              header: t("colKyc"),
              render: (row) =>
                row.kycStatus ? <StatusBadge status={row.kycStatus} /> : "—",
            },
            {
              key: "voen",
              header: t("colIdentity"),
              render: (row) => {
                if (row.voen) return row.voen;
                if (row.globalPersonId) {
                  const id = row.globalPersonId;
                  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
                }
                return "—";
              },
            },
            { key: "homeBranchId", header: t("colBranch") },
          ]}
          rows={gridRows}
          rowKey={(r) => r.id}
          addLabel={t("newCustomer")}
          onAdd={() => modal.open("create")}
          emptyMessage={tCommon("empty")}
        />
      )}
      <CifCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={(id) => {
          void load();
          modal.open("detail", id);
        }}
      />
      <CifDetailModal
        open={modal.mode === "detail"}
        customerId={modal.entityId}
        onClose={modal.close}
      />
    </div>
  );
}

export default function CifPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <CifPageContent />
    </Suspense>
  );
}
