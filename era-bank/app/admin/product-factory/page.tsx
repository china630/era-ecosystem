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
import {
  PRODUCT_KINDS,
  ProductFactoryModal,
  type ProductTemplateDetail,
} from "@/components/ops/modals/ProductFactoryModals";
import { StatusBadge } from "@/components/ops-ui";

const STATUS_FILTER = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "RETIRED", label: "RETIRED" },
];

function ProductFactoryPageContent() {
  const t = useTranslations("pages.productFactory");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<ProductTemplateDetail[]>([]);
  const [selected, setSelected] = useState<ProductTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const kindOptions = useMemo(
    () => [
      { value: "", label: t("kindAll") },
      ...PRODUCT_KINDS.map((k) => ({
        value: k,
        label: t(`kind_${k}` as "kind_CURRENT"),
      })),
    ],
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (kindFilter) params.set("kind", kindFilter);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/product-templates${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      const data = (await res.json()) as ProductTemplateDetail[];
      const needle = debouncedQ.trim().toLowerCase();
      setRows(
        needle
          ? data.filter(
              (r) =>
                (r.moduleKey ?? "").toLowerCase().includes(needle) ||
                (r.name ?? "").toLowerCase().includes(needle) ||
                (r.kind ?? "").toLowerCase().includes(needle),
            )
          : data,
      );
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, kindFilter, statusFilter, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lifecycle(id: string, action: "activate" | "retire") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/product-templates/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        showApiError(await res.text());
        return;
      }
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(id: string, mode: "edit" | "view") {
    try {
      const res = await fetch(`/api/product-templates/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      const data = (await res.json()) as ProductTemplateDetail;
      setSelected(data);
      modal.open(mode);
    } catch {
      showApiError(tCommon("error"));
    }
  }

  const gridRows = useMemo(
    () => rows as Array<ProductTemplateDetail & Record<string, unknown>>,
    [rows],
  );

  const modalMode =
    modal.mode === "create" || modal.mode === "edit" || modal.mode === "view"
      ? modal.mode
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setSelected(null);
              modal.open("create");
            }}
          >
            {t("create")}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setQ("");
          setKindFilter("");
          setStatusFilter("");
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
          label={t("kind")}
          options={kindOptions}
          value={kindFilter}
          onChange={(next) =>
            setKindFilter(Array.isArray(next) ? next[0] ?? "" : next)
          }
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colStatus")}
          options={STATUS_FILTER}
          value={statusFilter}
          onChange={(next) =>
            setStatusFilter(Array.isArray(next) ? next[0] ?? "" : next)
          }
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            { key: "moduleKey", header: t("colCode") },
            { key: "name", header: t("colName") },
            { key: "kind", header: t("colKind") },
            { key: "currency", header: t("colCurrency") },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) =>
                row.status ? <StatusBadge status={String(row.status)} /> : "—",
            },
            {
              key: "id",
              header: t("colActions"),
              render: (row) => {
                const id = String(row.id);
                const status = String(row.status ?? "");
                return (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => void openDetail(id, "view")}
                    >
                      {t("view")}
                    </button>
                    {status !== "RETIRED" && (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => void openDetail(id, "edit")}
                      >
                        {t("edit")}
                      </button>
                    )}
                    {status === "DRAFT" && (
                      <button
                        type="button"
                        className="text-xs underline"
                        disabled={busyId === id}
                        onClick={() => void lifecycle(id, "activate")}
                      >
                        {t("activate")}
                      </button>
                    )}
                    {status === "ACTIVE" && (
                      <button
                        type="button"
                        className="text-xs underline"
                        disabled={busyId === id}
                        onClick={() => void lifecycle(id, "retire")}
                      >
                        {t("retire")}
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
      <p className="text-[12px] text-muted-foreground">{tCommon("engineNote")}</p>
      {modalMode && (
        <ProductFactoryModal
          open
          mode={modalMode}
          initial={modalMode === "create" ? null : selected}
          onClose={modal.close}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

export default function ProductFactoryPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <ProductFactoryPageContent />
    </Suspense>
  );
}
