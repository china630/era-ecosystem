"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { LoanCreateModal, LoanDetailModal } from "@/components/ops/modals/LoanModals";
import { OpsError, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type Loan = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  outstandingMinor?: unknown;
  currency?: string;
  customerId?: string;
};

function LoansPageContent() {
  const t = useTranslations("pages.loans");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [rows, setRows] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/loans", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as Loan[]);
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
          addLabel={t("originate")}
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
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
            {
              key: "principalMinor",
              label: "Principal",
              render: (row) => formatAznMinor(row.principalMinor),
            },
            {
              key: "outstandingMinor",
              label: "Outstanding",
              render: (row) => formatAznMinor(row.outstandingMinor),
            },
          ]}
        />
      </div>
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
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <LoansPageContent />
    </Suspense>
  );
}
