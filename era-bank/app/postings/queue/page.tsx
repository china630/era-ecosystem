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
import { PostingCreateModal, PostingDetailModal } from "@/components/ops/modals/PostingModals";
import { StatusBadge } from "@/components/ops-ui";

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
  const debouncedBranch = useDebouncedValue(branchId, 300);
  const [rows, setRows] = useState<PostingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "PENDING" });
    if (debouncedBranch.trim()) params.set("branchId", debouncedBranch.trim());
    try {
      const res = await fetch(`/api/postings?${params}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as PostingRow[]);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedBranch, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridRows = useMemo(
    () => rows as Array<PostingRow & Record<string, unknown>>,
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
            {t("newPosting")}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => setBranchId("")}
      >
        <Field
          label={t("branchFilter")}
          preset="longText"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "reference",
              header: t("colReference"),
              render: (row) => (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => modal.open("detail", String(row.id))}
                >
                  {String(row.reference ?? String(row.id).slice(0, 10))}
                </button>
              ),
            },
            { key: "type", header: t("colType") },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) =>
                row.status ? <StatusBadge status={String(row.status)} /> : "—",
            },
            { key: "makerUserId", header: t("colMaker") },
            {
              key: "bookingDate",
              header: t("colDate"),
              render: (row) =>
                row.bookingDate ? String(row.bookingDate).slice(0, 10) : "—",
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
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
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <PostingsQueuePageContent />
    </Suspense>
  );
}
