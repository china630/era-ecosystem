"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { BranchCreateModal } from "@/components/ops/modals/BranchModals";
import { OpsError } from "@/components/ops-ui";

type Branch = { id: string; code?: string; name?: string; status?: string };

function BranchesAdminPageContent() {
  const t = useTranslations("pages.branches");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [rows, setRows] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/branches", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as Branch[]);
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
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex justify-end">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {tCommon("refresh")}
          </button>
        </div>
        <OpsDataTable
          rows={rows}
          addLabel={t("create")}
          onAdd={() => modal.open("create")}
          emptyLabel={tCommon("empty")}
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            {
              key: "id",
              label: "ID",
              render: (row) => <span className="font-mono text-[11px]">{row.id}</span>,
            },
          ]}
        />
      </div>
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
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <BranchesAdminPageContent />
    </Suspense>
  );
}
