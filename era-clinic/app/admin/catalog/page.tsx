"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { localizedCatalogDescription } from "@era/clinic-domain";
import { localizedDepartmentName } from "@/domain/catalog/department-label";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay, todayBakuYmd } from "@/lib/baku-day";

type CatalogRow = {
  id: string;
  code: string;
  description: string;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  amount: string;
  listAmount?: string | null;
  packageIncluded: boolean;
  department: string | null;
  departmentCode?: string | null;
  syncedAt: string;
  kind?: string;
  displayName?: string;
  effectiveFrom?: string;
};

type PriceHistoryRow = {
  id: string;
  amount: string;
  listAmount?: string | null;
  effectiveFrom: string;
};

const KIND_VALUES = ["PROCEDURE", "DIAGNOSTIC", "LAB", "VISIT", "OTHER"] as const;

type PackageFilter = "" | "paid" | "package";
type KindFilter = "" | "PROCEDURE" | "DIAGNOSTIC" | "LAB" | "VISIT" | "OTHER";
type MissingListFilter = "" | "1";

function isStale(syncedAt: string): boolean {
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

export default function CatalogAdminPage() {
  const t = useTranslations("catalogAdmin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const search = useSearchParams();
  const router = useRouter();
  const editCode = search.get("edit");
  const openedEdit = useRef("");
  const formId = useId();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [draft, setDraft] = useState({
    code: "",
    descriptionAz: "",
    descriptionRu: "",
    descriptionEn: "",
    amount: "",
    listAmount: "",
    packageIncluded: false,
    department: "",
    kind: "OTHER",
    effectiveFrom: "",
  });
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [deptRows, setDeptRows] = useState<
    Array<{
      code: string;
      nameAz: string | null;
      nameRu: string | null;
      nameEn: string | null;
      active?: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState({
    packageIncluded: "" as PackageFilter,
    department: search.get("department") ?? "",
    kind: "" as KindFilter,
    missingListPrice: "" as MissingListFilter,
  });
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const departmentQuery = search.get("department") ?? "";
  const departmentQuerySeen = useRef(departmentQuery);
  useEffect(() => {
    if (departmentQuerySeen.current === departmentQuery) return;
    departmentQuerySeen.current = departmentQuery;
    setFilters((prev) => ({ ...prev, department: departmentQuery }));
  }, [departmentQuery]);

  function setDepartmentFilter(code: string) {
    departmentQuerySeen.current = code;
    setFilters((prev) => ({ ...prev, department: code }));
    const params = new URLSearchParams(search.toString());
    if (code) params.set("department", code);
    else params.delete("department");
    const qs = params.toString();
    router.replace(qs ? `/admin/catalog?${qs}` : "/admin/catalog");
  }

  const latestSync = rows.reduce<Date | null>((max, row) => {
    const d = new Date(row.syncedAt);
    return !max || d > max ? d : max;
  }, null);

  const missingListPriceCount = useMemo(() => {
    return rows.filter((row) => {
      const list = row.listAmount != null ? Number(row.listAmount) : 0;
      const amount = Number(row.amount);
      return (row.packageIncluded || amount === 0) && !(list > 0);
    }).length;
  }, [rows]);

  const departments = useMemo(
    () =>
      deptRows
        .map((row) => ({
          code: row.code,
          label: localizedDepartmentName(row, locale),
          active: row.active !== false,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [deptRows, locale],
  );
  const priceDepartments = useMemo(
    () => departments.filter((dep) => dep.active || dep.code === draft.department),
    [departments, draft.department],
  );
  const deptKind =
    priceDepartments.length <= 12
      ? "CLOSED_SMALL"
      : priceDepartments.length <= 40
        ? "CLOSED_MEDIUM"
        : "SEARCHABLE";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        filters.missingListPrice === "1" ? "?missingListPrice=1" : "";
      const res = await fetch(`/api/admin/catalog${qs}`);
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
  }, [locale, filters.missingListPrice]);

  useEffect(() => {
    void load();
    void (async () => {
      const res = await fetch("/api/admin/departments");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.data ?? data) as typeof deptRows;
      setDeptRows(Array.isArray(list) ? list : []);
    })();
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
      if (filters.department && row.departmentCode !== filters.department) return false;
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
        render: (row) => {
          const list = row.listAmount != null ? Number(row.listAmount) : 0;
          if (row.packageIncluded) {
            return (
              <span className={TEXT_MUTED_CLASS}>
                {t("packageLabel")}
                {list > 0 ? ` · list ${list} AZN` : ""}
              </span>
            );
          }
          return `${row.amount} AZN`;
        },
      },
      {
        key: "department",
        header: t("department"),
        render: (row) => {
          const dept = deptRows.find((item) => item.code === row.departmentCode);
          return dept ? localizedDepartmentName(dept, locale) : row.department ?? "—";
        },
      },
      {
        key: "effectiveFrom",
        header: t("effectiveFrom"),
        render: (row) => bakuDateTimeDisplay(row.effectiveFrom ?? row.syncedAt),
      },
      {
        key: "actions",
        header: tc("actions"),
        render: (row) => (
          <button
            type="button"
            className={TABLE_ROW_ICON_BTN_CLASS}
            aria-label={tc("edit")}
            onClick={() => void openEdit(row)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        ),
      },
    ],
    [t, tc, locale, deptRows],
  );

  function openCreate() {
    setEditing(null);
    setHistory([]);
    setDraft({
      code: "",
      descriptionAz: "",
      descriptionRu: "",
      descriptionEn: "",
      amount: "",
      listAmount: "",
      packageIncluded: false,
      department: "",
      kind: "OTHER",
      effectiveFrom: todayBakuYmd(),
    });
    setEditorOpen(true);
  }

  async function openEdit(row: CatalogRow) {
    setEditing(row);
    setDraft({
      code: row.code,
      descriptionAz: row.descriptionAz ?? row.description ?? "",
      descriptionRu: row.descriptionRu ?? "",
      descriptionEn: row.descriptionEn ?? "",
      amount: String(row.amount ?? ""),
      listAmount: row.listAmount != null ? String(row.listAmount) : "",
      packageIncluded: row.packageIncluded,
      department: row.departmentCode ?? "",
      kind: row.kind ?? "OTHER",
      effectiveFrom: todayBakuYmd(),
    });
    setHistory([]);
    setEditorOpen(true);
    const res = await fetch(`/api/admin/catalog/${row.id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { prices?: PriceHistoryRow[] };
    setHistory(data.prices ?? []);
  }

  useEffect(() => {
    if (!editCode || openedEdit.current === editCode || rows.length === 0) return;
    const row = rows.find((item) => item.code === editCode);
    if (!row) return;
    openedEdit.current = editCode;
    void openEdit(row);
  }, [editCode, rows]);

  async function saveCatalog(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        description: draft.descriptionAz || draft.descriptionRu || draft.descriptionEn || draft.code,
        descriptionAz: draft.descriptionAz,
        descriptionRu: draft.descriptionRu,
        descriptionEn: draft.descriptionEn,
        amount: Number(draft.amount || 0),
        listAmount: draft.listAmount.trim() === "" ? null : Number(draft.listAmount),
        packageIncluded: draft.packageIncluded,
        departmentCode: draft.department || null,
        kind: draft.kind,
        effectiveFrom: draft.effectiveFrom,
        ...(editing ? {} : { code: draft.code.trim() }),
      };
      const res = await fetch(editing ? `/api/admin/catalog/${editing.id}` : "/api/admin/catalog", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showApiError(
          await res.json().catch(() => ({})),
          res.status === 409 ? t("codeExists") : tc("failed"),
        );
        return;
      }
      showSuccess(tc("saved"));
      setEditorOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    const res = await fetch("/api/catalog/sync", { method: "POST" });
    const d = await res.json();
    const payload = (d.data ?? d) as { synced?: number; source?: string };
    if (!res.ok) {
      showApiError(d, tc("failed"));
    } else if (payload.source === "unavailable") {
      showApiError({ error: t("syncUnavailable") });
    } else {
      showSuccess(t("synced", { count: payload.synced ?? 0 }));
    }
    await load();
  }

  async function importNafta() {
    const res = await fetch("/api/admin/catalog/import-nafta", { method: "POST" });
    const d = await res.json();
    const payload = d.data ?? d;
    if (!res.ok) {
      showApiError(d, tc("failed"));
      return;
    }
    if (payload.skipped) {
      showApiError({ error: payload.message ?? t("importSkipped") });
    } else {
      showSuccess(
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
    setDepartmentFilter("");
    setFilters({
      packageIncluded: "" as PackageFilter,
      department: "",
      kind: "" as KindFilter,
      missingListPrice: "" as MissingListFilter,
    });
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
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void sync()}>
              {t("syncFromFinance")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {tc("add")}
            </button>
          </>
        }
      />
      {missingListPriceCount > 0 ? (
        <p className="mb-3 text-[13px] text-amber-700">
          {t("missingListPriceNote", { count: missingListPriceCount })}
        </p>
      ) : null}
      {latestSync ? (
        <p
          className={`mb-3 text-[13px] ${isStale(latestSync.toISOString()) ? "text-amber-700" : TEXT_MUTED_CLASS}`}
        >
          {t("lastSync")}: {bakuDateTimeDisplay(latestSync)}
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
          label={t("filterMissingListPrice")}
          preset="select"
          value={filters.missingListPrice}
          onChange={(e) =>
            setFilters({
              ...filters,
              missingListPrice: e.target.value as MissingListFilter,
            })
          }
        >
          <option value="">{t("filterMissingListPriceAll")}</option>
          <option value="1">{t("filterMissingListPriceOnly")}</option>
        </FieldSelect>
        <FieldSelect
          label={t("department")}
          preset="select"
          value={filters.department}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">{t("filterDepartmentAll")}</option>
          {departments.map((dep) => (
            <option key={dep.code} value={dep.code}>
              {dep.active ? dep.label : `${dep.label} · ${t("departmentInactive")}`}
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
            <EraDataGrid
              columns={columns}
              rows={pagedRows}
              rowKey={(row) => row.id}
              pagination={false}
            />
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
      <ModalShell
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? tc("edit") : tc("add")}
        maxWidthClass="max-w-5xl w-full"
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setEditorOpen(false)}
            cancelLabel={tc("cancel")}
            busy={saving}
            submitLabel={tc("save")}
          />
        }
      >
        <form id={formId} className="space-y-3" onSubmit={(e) => void saveCatalog(e)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
          {editing ? (
            <Field label={t("code")} preset="code" value={draft.code} readOnly />
          ) : (
            <Field
              label={t("code")}
              preset="code"
              value={draft.code}
              required
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          )}
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("filterKind")}
            value={draft.kind}
            emptyLabel={null}
            options={KIND_VALUES.map((value) => ({
              value,
              label:
                value === "PROCEDURE"
                  ? t("filterKindProcedure")
                  : value === "DIAGNOSTIC"
                    ? t("filterKindDiagnostic")
                    : value === "LAB"
                      ? t("filterKindLab")
                      : value === "VISIT"
                        ? t("filterKindVisit")
                        : t("filterKindOther"),
            }))}
            onChange={(next) => setDraft({ ...draft, kind: String(next) })}
          />
          <Field
            label={t("amount")}
            preset="amount"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          />
          <Field
            label={t("listAmount")}
            preset="amount"
            value={draft.listAmount}
            onChange={(e) => setDraft({ ...draft, listAmount: e.target.value })}
          />
          <DatePicker
            label={t("effectiveFrom")}
            placeholder={tc("datePlaceholder")}
            value={draft.effectiveFrom}
            onChange={(value) => setDraft({ ...draft, effectiveFrom: value })}
          />
            </div>
            <div className="space-y-3">
          <Field
            label={t("descriptionAz")}
            preset="shortText"
            value={draft.descriptionAz}
            onChange={(e) => setDraft({ ...draft, descriptionAz: e.target.value })}
          />
          <Field
            label={t("descriptionRu")}
            preset="shortText"
            value={draft.descriptionRu}
            onChange={(e) => setDraft({ ...draft, descriptionRu: e.target.value })}
          />
          <Field
            label={t("descriptionEn")}
            preset="shortText"
            value={draft.descriptionEn}
            onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })}
          />
            </div>
          </div>
          <CatalogField
            kind={deptKind}
            label={t("department")}
            value={draft.department}
            emptyLabel="—"
            options={priceDepartments.map((dep) => ({ value: dep.code, label: dep.label }))}
            onChange={(next) => setDraft({ ...draft, department: String(next ?? "") })}
          />
          {draft.department ? (
            <div className="flex flex-wrap gap-3 text-[13px]">
              {(["nameAz", "nameRu", "nameEn"] as const).map((key, index) => {
                const dept = deptRows.find((item) => item.code === draft.department);
                const text = dept?.[key]?.trim();
                const lang = ["AZ", "RU", "EN"][index];
                return (
                  <a
                    key={key}
                    className="text-[#1F4E79] underline"
                    href={`/admin/departments?edit=${encodeURIComponent(draft.department)}`}
                  >
                    {text || lang}
                  </a>
                );
              })}
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={draft.packageIncluded}
              onChange={(e) => setDraft({ ...draft, packageIncluded: e.target.checked })}
            />
            {t("packageLabel")}
          </label>
          {history.length > 0 ? (
            <div>
              <p className="mb-1 text-[13px] font-medium">{t("priceHistory")}</p>
              <ul className="space-y-1 text-[13px]">
                {history.map((row) => (
                  <li key={row.id}>
                    {bakuDateTimeDisplay(row.effectiveFrom)} · {row.amount} AZN
                    {row.listAmount != null ? ` · list ${row.listAmount}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      </ModalShell>
    </>
  );
}
