"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { DepositCreateModal, DepositDetailModal } from "@/components/ops/modals/DepositModals";
import { OpsError, StatusBadge, formatAznMinor } from "@/components/ops-ui";

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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/deposits", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as Deposit[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          addLabel={t("openDeposit")}
          onAdd={() => modal.open("create")}
          emptyLabel={tCommon("empty")}
          onRowClick={(row) => modal.open("detail", row.id)}
          columns={[
            {
              key: "id",
              label: "ID",
              render: (row) => <span className="text-primary">{row.id.slice(0, 10)}…</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <>
                  {row.status ? <StatusBadge status={row.status} /> : "—"}
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
              label: "Principal",
              render: (row) => formatAznMinor(row.principalMinor),
            },
            {
              key: "maturityDate",
              label: "Maturity",
              render: (row) => row.maturityDate?.slice(0, 10) ?? "—",
            },
          ]}
        />
      </div>
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
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <DepositsPageContent />
    </Suspense>
  );
}
