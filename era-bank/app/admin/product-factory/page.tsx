"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { ProductFactoryCreateModal } from "@/components/ops/modals/ProductFactoryModals";
import { OpsError, StatusBadge } from "@/components/ops-ui";

type ProductTemplate = {
  id: string;
  moduleKey?: string;
  kind?: string;
  name?: string;
  currency?: string;
  status?: string;
};

function ProductFactoryPageContent() {
  const t = useTranslations("pages.productFactory");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [rows, setRows] = useState<ProductTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/product-templates", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as ProductTemplate[]);
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
            { key: "moduleKey", label: t("code") },
            { key: "name", label: t("name") },
            { key: "kind", label: t("kind") },
            { key: "currency", label: t("currency") },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
          ]}
        />
      </div>
      <p className="text-[12px] text-muted-foreground">{tCommon("engineNote")}</p>
      <ProductFactoryCreateModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={() => void load()}
      />
    </div>
  );
}

export default function ProductFactoryPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <ProductFactoryPageContent />
    </Suspense>
  );
}
