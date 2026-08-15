"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { useOpsModal } from "@/components/ops";
import { LoanCreateModal, LoanDetailModal } from "@/components/ops/modals/LoanModals";
import { StatusBadge, formatAznMinor } from "@/components/ops-ui";

type Loan = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  outstandingMinor?: unknown;
  currency?: string;
  customerId?: string;
  ifrs9Stage?: number;
  akbScore?: number | null;
  daysPastDue?: number;
  isNpl?: boolean;
};

function LoansPageContent() {
  const t = useTranslations("pages.loans");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPricingOnly, setPendingPricingOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = pendingPricingOnly ? "?pendingPricing=1" : "";
      const res = await fetch(`/api/loans${qs}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      let list = (await res.json()) as Loan[];
      const needle = debouncedQ.trim().toLowerCase();
      if (needle) {
        list = list.filter(
          (r) =>
            r.id.toLowerCase().includes(needle) ||
            (r.customerId ?? "").toLowerCase().includes(needle) ||
            (r.status ?? "").toLowerCase().includes(needle),
        );
      }
      setRows(list);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, pendingPricingOnly, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridRows = useMemo(
    () => rows as Array<Loan & Record<string, unknown>>,
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
            {t("originate")}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setQ("");
          setPendingPricingOnly(false);
        }}
      >
        <Field
          label={t("searchLabel")}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("pendingPricingFilter")}
          options={[
            { value: "0", label: t("allLoans") },
            { value: "1", label: t("pendingPricingOnly") },
          ]}
          value={pendingPricingOnly ? "1" : "0"}
          onChange={(next) => {
            const v = Array.isArray(next) ? next[0] ?? "0" : next;
            setPendingPricingOnly(v === "1");
          }}
          emptyLabel={null}
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
                  onClick={() => modal.open("detail", String(row.id))}
                >
                  {String(row.id).slice(0, 10)}…
                </button>
              ),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) => (
                <span className="inline-flex items-center gap-1">
                  {row.status ? <StatusBadge status={String(row.status)} /> : "—"}
                  {row.isNpl || Number(row.ifrs9Stage) >= 3 ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800">
                      NPL
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              key: "ifrs9Stage",
              header: t("colStage"),
              render: (row) => String(row.ifrs9Stage ?? 1),
            },
            {
              key: "akbScore",
              header: t("colBureau"),
              render: (row) =>
                row.akbScore != null ? String(row.akbScore) : "—",
            },
            {
              key: "principalMinor",
              header: t("colPrincipal"),
              render: (row) => formatAznMinor(row.principalMinor),
            },
            {
              key: "outstandingMinor",
              header: t("colOutstanding"),
              render: (row) => formatAznMinor(row.outstandingMinor),
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
      <LoanCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={(id) => {
          void load();
          modal.open("detail", id);
        }}
      />
      <LoanDetailModal
        open={modal.mode === "detail"}
        loanId={modal.entityId}
        onClose={modal.close}
        onUpdated={() => void load()}
      />
    </div>
  );
}

export default function LoansPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <LoansPageContent />
    </Suspense>
  );
}
