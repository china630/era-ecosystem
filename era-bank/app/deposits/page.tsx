"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  EraListFilterBar,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { useOpsModal } from "@/components/ops";
import {
  DepositCreateModal,
  DepositDetailModal,
} from "@/components/ops/modals/DepositModals";
import { StatusBadge, formatAznMinor } from "@/components/ops-ui";

type Deposit = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  currency?: string;
  customerId?: string;
  accountId?: string;
  maturityDate?: string;
  adifTagged?: boolean;
};

function DepositsPageContent() {
  const t = useTranslations("pages.deposits");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [rows, setRows] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPricingOnly, setPendingPricingOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = pendingPricingOnly ? "?pendingPricing=1" : "";
      const res = await fetch(`/api/deposits${qs}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Deposit[]);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [pendingPricingOnly, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridRows = useMemo(
    () => rows as Array<Deposit & Record<string, unknown>>,
    [rows],
  );

  const pendingOptions = useMemo(
    () => [
      { value: "0", label: t("allDeposits") },
      { value: "1", label: t("pendingPricingOnly") },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void load()}
            >
              {tCommon("refresh")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => modal.open("create")}
            >
              {t("openDeposit")}
            </button>
          </div>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => setPendingPricingOnly(false)}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("pendingPricingFilter")}
          options={pendingOptions}
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
                <>
                  {row.status ? (
                    <StatusBadge status={String(row.status)} />
                  ) : (
                    "—"
                  )}
                  {row.adifTagged ? (
                    <span className="ml-1 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800">
                      ADİF
                    </span>
                  ) : null}
                </>
              ),
            },
            {
              key: "principalMinor",
              header: t("colPrincipal"),
              render: (row) => formatAznMinor(row.principalMinor),
            },
            {
              key: "maturityDate",
              header: t("colMaturity"),
              render: (row) =>
                row.maturityDate
                  ? String(row.maturityDate).slice(0, 10)
                  : "—",
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
      <DepositCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={(id) => {
          void load();
          modal.open("detail", id);
        }}
      />
      <DepositDetailModal
        open={modal.mode === "detail"}
        depositId={modal.entityId}
        onClose={modal.close}
        onUpdated={() => void load()}
      />
    </div>
  );
}

export default function DepositsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <DepositsPageContent />
    </Suspense>
  );
}
