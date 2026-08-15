"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localizedCatalogDescription } from "@era/clinic-domain";
import {
  CARD_CONTAINER_CLASS,
  EraDataGrid,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";

type CatalogRow = {
  id: string;
  code: string;
  description: string;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  amount: string;
  packageIncluded: boolean;
  department: string | null;
  syncedAt: string;
  kind?: string;
  displayName?: string;
};

type PackageFilter = "" | "paid" | "package";
type KindFilter = "" | "PROCEDURE" | "DIAGNOSTIC" | "LAB" | "VISIT" | "OTHER";

function isStale(syncedAt: string): boolean {
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

export default function CatalogAdminPage() {
  const t = useTranslations("catalogAdmin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState({
    packageIncluded: "" as PackageFilter,
    department: "",
    kind: "" as KindFilter,
  });
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const latestSync = rows.reduce<Date | null>((max, row) => {
    const d = new Date(row.syncedAt);
    return !max || d > max ? d : max;
  }, null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.department?.trim()) set.add(row.department.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalog");
      if (res.ok) {
        const d = await res.json();
        const raw = (d.data ?? d) as CatalogRow[];
        setRows(
          raw.map((row) => ({
            ...row,
            displayName: localizedCatalogDescription(row, locale),
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const hay =
          `${row.code} ${row.displayName ?? ""} ${row.description} ${row.descriptionAz ?? ""} ${row.descriptionRu ?? ""} ${row.descriptionEn ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (filters.packageIncluded === "package" && !row.packageIncluded) return false;
      if (filters.packageIncluded === "paid" && row.packageIncluded) return false;
      if (filters.department && row.department !== filters.department) return false;
      if (filters.kind && row.kind !== filters.kind) return false;
      return true;
    });
  }, [rows, debouncedQ, filters]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters, pageSize]);

  const columns = useMemo<EraDataGridColumn<CatalogRow>[]>(
    () => [
      {
        key: "description",
        header: t("description"),
        render: (row) => row.displayName ?? localizedCatalogDescription(row, locale),
      },
      { key: "code", header: t("code") },
      {
        key: "amount",
        header: t("amount"),
        render: (row) =>
          row.packageIncluded ? (
            <span className={TEXT_MUTED_CLASS}>{t("packageLabel")}</span>
          ) : (
            `${row.amount} AZN`
          ),
      },
      {
        key: "department",
        header: t("department"),
        render: (row) => row.department ?? "—",
      },
      {
        key: "syncedAt",
        header: t("lastSync"),
        render: (row) => (
          <span className={isStale(row.syncedAt) ? "text-amber-700" : undefined}>
            {new Date(row.syncedAt).toLocaleString()}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  async function sync() {
    setMsg(null);
    const res = await fetch("/api/catalog/sync", { method: "POST" });
    const d = await res.json();
    setMsg(res.ok ? t("synced", { count: d.data?.synced ?? d.synced ?? 0 }) : tc("failed"));
    await load();
  }

  async function importNafta() {
    setMsg(null);
    const res = await fetch("/api/admin/catalog/import-nafta", { method: "POST" });
    const d = await res.json();
    const payload = d.data ?? d;
    if (!res.ok) {
      setMsg(tc("failed"));
      return;
    }
    if (payload.skipped) {
      setMsg(payload.message ?? t("importSkipped"));
    } else {
      setMsg(
        t("imported", {
          catalog: payload.catalogCount ?? 0,
          types: payload.typeCount ?? 0,
        }),
      );
    }
    await load();
  }

  function resetFilters() {
    setQ("");
    setFilters({ packageIncluded: "" as PackageFilter, department: "", kind: "" as KindFilter });
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void importNafta()}>
              {t("importNaftaPrices")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void sync()}>
              {t("syncFromFinance")}
            </button>
          </>
        }
      />
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
      {latestSync ? (
        <p
          className={`mb-3 text-[13px] ${isStale(latestSync.toISOString()) ? "text-amber-700" : TEXT_MUTED_CLASS}`}
        >
          {t("lastSync")}: {latestSync.toLocaleString()}
          {isStale(latestSync.toISOString()) ? ` · ${t("stale")}` : ""}
        </p>
      ) : null}
      <EraListFilterBar
        resetLabel={t("filterReset")}
        onReset={resetFilters}
      >
        <Field
          label={t("filterQ")}
          preset="shortText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FieldSelect
          label={t("filterKind")}
          preset="select"
          value={filters.kind}
          onChange={(e) =>
            setFilters({ ...filters, kind: e.target.value as KindFilter })
          }
        >
          <option value="">{t("filterKindAll")}</option>
          <option value="PROCEDURE">{t("filterKindProcedure")}</option>
          <option value="DIAGNOSTIC">{t("filterKindDiagnostic")}</option>
          <option value="LAB">{t("filterKindLab")}</option>
          <option value="VISIT">{t("filterKindVisit")}</option>
          <option value="OTHER">{t("filterKindOther")}</option>
        </FieldSelect>
        <FieldSelect
          label={t("filterPackage")}
          preset="select"
          value={filters.packageIncluded}
          onChange={(e) =>
            setFilters({
              ...filters,
              packageIncluded: e.target.value as PackageFilter,
            })
          }
        >
          <option value="">{t("filterPackageAll")}</option>
          <option value="paid">{t("filterPackagePaid")}</option>
          <option value="package">{t("filterPackageIncluded")}</option>
        </FieldSelect>
        <FieldSelect
          label={t("department")}
          preset="select"
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
        >
          <option value="">{t("filterDepartmentAll")}</option>
          {departments.map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </FieldSelect>
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        {loading ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
        ) : filteredRows.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
            {t("empty")}{" "}
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void sync()}>
              {t("syncFromFinance")}
            </button>
          </p>
        ) : (
          <>
            <EraDataGrid columns={columns} rows={pagedRows} rowKey={(row) => row.id} />
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={filteredRows.length}
              loading={loading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              labels={{
                rowsPerPage: t("rowsPerPage"),
                pageOf: t("pageOf"),
                prev: t("prev"),
                next: t("next"),
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
