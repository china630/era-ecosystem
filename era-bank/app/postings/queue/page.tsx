"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { PostingCreateModal, PostingDetailModal } from "@/components/ops/modals/PostingModals";
import { OpsError, StatusBadge } from "@/components/ops-ui";

type PostingRow = {
  id: string;
  reference?: string;
  type?: string;
  status?: string;
  makerUserId?: string;
  branchId?: string;
  bookingDate?: string;
};

function PostingsQueuePageContent() {
  const t = useTranslations("pages.postings");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<PostingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ status: "PENDING" });
    if (branchId.trim()) params.set("branchId", branchId.trim());
    try {
      const res = await fetch(`/api/postings?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as PostingRow[]);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [branchId, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder={t("branchFilter")}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        />
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
            addLabel={t("newPosting")}
            onAdd={() => modal.open("create")}
            emptyLabel={tCommon("empty")}
            onRowClick={(row) => modal.open("detail", row.id)}
            columns={[
              {
                key: "reference",
                label: "Reference",
                render: (row) => (
                  <span className="text-primary">{row.reference ?? row.id.slice(0, 10)}</span>
                ),
              },
              { key: "type", label: "Type" },
              {
                key: "status",
                label: "Status",
                render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
              },
              { key: "makerUserId", label: "Maker" },
              {
                key: "bookingDate",
                label: "Date",
                render: (row) => row.bookingDate?.slice(0, 10) ?? "—",
              },
            ]}
          />
        ) : null}
      </div>
      <PostingCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={(id) => {
          void load();
          modal.open("detail", id);
        }}
      />
      <PostingDetailModal
        open={modal.mode === "detail"}
        postingId={modal.entityId}
        onClose={modal.close}
        onUpdated={() => void load()}
      />
    </div>
  );
}

export default function PostingsQueuePage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <PostingsQueuePageContent />
    </Suspense>
  );
}
