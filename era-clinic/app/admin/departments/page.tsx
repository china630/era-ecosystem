"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { localizedDepartmentName } from "@/domain/catalog/department-label";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FORM_STACK_CLASS,
  LINK_ACCENT_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type DeptRow = {
  id: string;
  code: string;
  nameAz: string | null;
  nameRu: string | null;
  nameEn: string | null;
  active: boolean;
  serviceCount: number;
};

const EMPTY = { code: "", nameAz: "", nameRu: "", nameEn: "" };

export default function DepartmentsAdminPage() {
  const t = useTranslations("catalogAdmin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const formId = useId();
  const search = useSearchParams();
  const editCode = search.get("edit");
  const openedEdit = useRef("");
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [edit, setEdit] = useState<DeptRow | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    const list = (data.data ?? data) as DeptRow[];
    setRows(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openRow(row: DeptRow | null) {
    setEdit(row);
    setDraft(
      row
        ? {
            code: row.code,
            nameAz: row.nameAz ?? "",
            nameRu: row.nameRu ?? "",
            nameEn: row.nameEn ?? "",
          }
        : EMPTY,
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!editCode || openedEdit.current === editCode || rows.length === 0) return;
    const row = rows.find((item) => item.code === editCode);
    if (!row) return;
    openedEdit.current = editCode;
    openRow(row);
  }, [editCode, rows]);

  async function setActive(row: DeptRow, active: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/departments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      showSuccess(active ? t("departmentActivated") : t("departmentDeactivated"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: DeptRow) {
    if (row.serviceCount > 0) {
      showApiError({ error: t("departmentDeleteBlocked") });
      return;
    }
    if (!window.confirm(t("departmentDeleteConfirm", { name: localizedDepartmentName(row, locale) }))) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/departments/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(
          data.code === "DEPARTMENT_IN_USE" ? { error: t("departmentDeleteBlocked") } : data,
          tc("failed"),
        );
        return;
      }
      showSuccess(t("departmentDeleted"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        code: draft.code.trim(),
        nameAz: draft.nameAz.trim() || null,
        nameRu: draft.nameRu.trim() || null,
        nameEn: draft.nameEn.trim() || null,
      };
      const res = await fetch(edit ? `/api/admin/departments/${edit.id}` : "/api/admin/departments", {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      showSuccess(tc("saved"));
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        className="!mb-0"
        title={t("departmentsTitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => openRow(null)}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc("add")}
          </button>
        }
      />
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("department")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>AZ</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>RU</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>EN</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("serviceCount")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{localizedDepartmentName(row, locale)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.nameAz || "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.nameRu || "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.nameEn || "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <Link
                    href={`/admin/catalog?department=${encodeURIComponent(row.code)}`}
                    className={LINK_ACCENT_CLASS}
                  >
                    {row.serviceCount}
                  </Link>
                  {row.active ? null : (
                    <span className="ml-2 text-[11px] text-slate-400">{t("departmentInactive")}</span>
                  )}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      onClick={() => openRow(row)}
                      aria-label={tc("edit")}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      disabled={busy}
                      title={row.active ? t("departmentDeactivate") : t("departmentActivate")}
                      aria-label={row.active ? t("departmentDeactivate") : t("departmentActivate")}
                      onClick={() => void setActive(row, !row.active)}
                    >
                      <Power className={`h-4 w-4 ${row.active ? "text-[#27AE60]" : "text-slate-400"}`} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      disabled={busy || row.serviceCount > 0}
                      title={row.serviceCount > 0 ? t("departmentDeleteBlocked") : tc("delete")}
                      aria-label={tc("delete")}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title={edit ? tc("edit") : tc("add")}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setOpen(false)}
            cancelLabel={tc("cancel")}
            busy={busy}
            submitLabel={tc("save")}
          />
        }
      >
        <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => void save(e)}>
          <Field
            label={t("code")}
            preset="code"
            value={draft.code}
            required
            readOnly={Boolean(edit)}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          />
          <Field
            label={t("descriptionAz")}
            preset="shortText"
            value={draft.nameAz}
            onChange={(e) => setDraft({ ...draft, nameAz: e.target.value })}
          />
          <Field
            label={t("descriptionRu")}
            preset="shortText"
            value={draft.nameRu}
            onChange={(e) => setDraft({ ...draft, nameRu: e.target.value })}
          />
          <Field
            label={t("descriptionEn")}
            preset="shortText"
            value={draft.nameEn}
            onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
          />
        </form>
      </ModalShell>
    </div>
  );
}
