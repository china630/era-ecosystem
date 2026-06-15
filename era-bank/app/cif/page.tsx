"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { CifCreateModal, CifDetailModal } from "@/components/ops/modals/CifModals";
import { OpsError, StatusBadge } from "@/components/ops-ui";

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
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/cif/customers${qs}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as Customer[]);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [q, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3`}>
        <label className="min-w-[240px] flex-1">
          <span className="mb-1 block text-[12px] text-muted-foreground">{t("searchLabel")}</span>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </label>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? <p className="text-sm text-muted-foreground">{tCommon("loading")}</p> : null}
        {!loading ? (
          <OpsDataTable
            rows={rows}
            addLabel={t("newCustomer")}
            onAdd={() => modal.open("create")}
            emptyLabel={tCommon("empty")}
            onRowClick={(row) => modal.open("detail", row.id)}
            columns={[
              {
                key: "id",
                label: "ID",
                render: (row) => <span className="text-primary">{row.id.slice(0, 12)}…</span>,
              },
              { key: "customerType", label: "Type" },
              {
                key: "kycStatus",
                label: "KYC",
                render: (row) =>
                  row.kycStatus ? <StatusBadge status={row.kycStatus} /> : "—",
              },
              {
                key: "voen",
                label: "VÖEN / Person",
                render: (row) => {
                  if (row.voen) return row.voen;
                  if (row.globalPersonId) {
                    const id = row.globalPersonId;
                    return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
                  }
                  return "—";
                },
              },
              { key: "homeBranchId", label: "Branch" },
            ]}
          />
        ) : null}
      </div>
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
