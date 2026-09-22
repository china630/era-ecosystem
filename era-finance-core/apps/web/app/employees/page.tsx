"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { CatalogField } from "@era/satellite-kit/ui";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { useAuth } from "../../lib/auth-context";
import { isRestrictedUserRole } from "../../lib/role-utils";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import { EmptyState } from "../../components/empty-state";
import { ListPaginationFooter } from "../../components/list-pagination-footer";
import { PageHeader } from "../../components/layout/page-header";
import { parseHrEmployeesResponse } from "../../lib/hr-employees-list";
import {
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  LINK_ACCENT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import {
  parseBulkContractSalaryCsv,
  type BulkSalarySkipReason,
} from "../../lib/bulk-contract-salary-csv";
import { formatAzEmployeeListName } from "../../lib/employee-display-name";
import { CreateEmployeeModal } from "./employee-modal";
import { EditEmployeeModal } from "./edit-employee-modal";
import { RpaUpsellModal } from "../../components/rpa-upsell-modal";

const ORCH_WEB_BASE = (
  process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");

function cpTerminateUrl(cpEmploymentId: string): string {
  return `${ORCH_WEB_BASE}/workspace/workforce/employments?employmentId=${encodeURIComponent(cpEmploymentId)}`;
}

type Employee = {
  id: string;
  kind?: string;
  cpEmploymentId?: string | null;
  finCode: string;
  voen?: string | null;
  firstName: string;
  lastName: string;
  middleName?: string;
  displayName?: string | null;
  positionId: string;
  jobPosition?: {
    id: string;
    name: string;
    department: { id: string; name: string };
  };
  startDate: string;
  salary: unknown;
  emasEligible?: boolean;
  contractorMonthlySocialAzn?: unknown | null;
};

function salaryNumber(salary: unknown): number {
  if (salary == null) return 0;
  const s =
    typeof salary === "object" && salary !== null && "toString" in salary
      ? (salary as { toString(): string }).toString()
      : String(salary);
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isPendingFin(r: Employee): boolean {
  return r.emasEligible === false || !r.finCode || r.finCode === "—";
}

function isSalaryZero(r: Employee): boolean {
  return salaryNumber(r.salary) <= 0;
}

export default function EmployeesPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const cpEmploymentIdFilter = searchParams.get("cpEmploymentId")?.trim() || "";
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const hideDestructive = isRestrictedUserRole(user?.role ?? undefined);
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [salaryFilter, setSalaryFilter] = useState<"all" | "missing">("all");

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const cpQs = cpEmploymentIdFilter
      ? `&cpEmploymentId=${encodeURIComponent(cpEmploymentIdFilter)}`
      : "";
    const res = await apiFetch(
      `/api/hr/employees?page=${page}&pageSize=${pageSize}${cpQs}`,
    );
    if (!res.ok) {
      setError(`${t("employees.loadErr")}: ${res.status}`);
      setRows([]);
      setTotal(0);
    } else {
      const parsed = parseHrEmployeesResponse<Employee>(await res.json());
      setRows(parsed.items);
      setTotal(parsed.total);
    }
    setLoading(false);
  }, [token, t, page, pageSize, cpEmploymentIdFilter]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  const salaryZeroCount = useMemo(
    () => rows.filter((r) => isSalaryZero(r)).length,
    [rows],
  );

  const visibleRows = useMemo(() => {
    if (salaryFilter === "missing") return rows.filter((r) => isSalaryZero(r));
    return rows;
  }, [rows, salaryFilter]);

  const salaryFilterOptions = useMemo(
    () => [
      { value: "all", label: t("employees.salaryFilterAll") },
      { value: "missing", label: t("employees.salaryFilterMissing") },
    ],
    [t],
  );

  async function remove(id: string) {
    if (!token || !window.confirm(t("employees.confirmDelete"))) return;
    const res = await apiFetch(`/api/hr/employees/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await load();
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((cur) => {
      if (checked) return Array.from(new Set([...cur, id]));
      return cur.filter((x) => x !== id);
    });
  }

  async function exportBulkExcel() {
    if (selectedIds.length === 0) return;
    const res = await apiFetch(
      `/api/integrations/emas/employees/export.xlsx?ids=${encodeURIComponent(selectedIds.join(","))}`,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emas-employees-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBulkExcel(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/integrations/emas/employees/import-result", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      alert(
        t("bulk.employees.importErr", {
          defaultValue: "Excel import failed: {{status}}",
          status: res.status,
        }) + `\n${await res.text()}`,
      );
      return;
    }
    const j = (await res.json()) as {
      matched?: number;
      unmatched?: number;
      errors?: string[];
    };
    toast.success(
      t("bulk.employees.importResult", {
        defaultValue:
          "Import: {{matched}} matched, {{unmatched}} unmatched, {{errors}} errors",
        matched: j.matched ?? 0,
        unmatched: j.unmatched ?? 0,
        errors: j.errors?.length ?? 0,
      }),
      {
        action: {
          label: t("employees.emas.openQueue", "ƏMAS queue"),
          onClick: () => {
            window.location.href = "/hr/emas-queue";
          },
        },
      },
    );
    await load();
  }

  function renderRowActions(r: Employee) {
    return (
      <>
        <button
          type="button"
          className={TABLE_ROW_ICON_BTN_CLASS}
          title={t("employees.change")}
          onClick={() => setEditEmployeeId(r.id)}
        >
          <Pencil className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
        </button>
        {!hideDestructive &&
          (r.cpEmploymentId ? (
            <a
              href={cpTerminateUrl(r.cpEmploymentId)}
              target="_blank"
              rel="noreferrer"
              className={`${SECONDARY_BUTTON_CLASS} whitespace-nowrap px-2 py-1 text-[11px]`}
              title={t(
                "employees.terminateInCpTitle",
                "Finance delete archives the mirror only. Terminate employment in Control Plane for ƏMAS / labor compliance.",
              )}
            >
              {t("employees.terminateInCp", "Terminate in Control Plane")}
            </a>
          ) : (
            <button
              type="button"
              className={TABLE_ROW_ICON_BTN_CLASS}
              title={t("employees.remove")}
              onClick={() => void remove(r.id)}
            >
              <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
            </button>
          ))}
      </>
    );
  }

  function skipReasonLabel(reason: BulkSalarySkipReason): string {
    return t(`employees.bulkSalarySkip.${reason}`, reason);
  }

  /** Wave 1/5: CSV `employeeId,salary[,internalRate]` (header optional). */
  async function importContractSalaryCsv(file: File) {
    const text = await file.text();
    if (!text.trim()) {
      alert(t("employees.bulkSalaryEmpty"));
      return;
    }
    const { items, skipped } = parseBulkContractSalaryCsv(text);
    if (items.length === 0) {
      alert(t("employees.bulkSalaryParseErr"));
      return;
    }
    const res = await apiFetch("/api/hr/employees/bulk-contract-salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    const j = (await res.json()) as {
      updated?: number;
      missingIds?: string[];
    };
    const skipPreview = skipped
      .slice(0, 5)
      .map(
        (s) =>
          `#${s.line} ${skipReasonLabel(s.reason)}: ${s.raw.slice(0, 60)}`,
      )
      .join("\n");
    const summary = t("employees.bulkSalaryDone", {
      updated: j.updated ?? 0,
      missing: j.missingIds?.length ?? 0,
      skipped: skipped.length,
    });
    alert(
      skipped.length > 0
        ? `${summary}\n\n${t("employees.bulkSalarySkippedPreview", "Skipped lines:")}\n${skipPreview}`
        : summary,
    );
    await load();
  }

  async function exportActiveListExcel() {
    const res = await apiFetch("/api/hr/reports/active-list.xlsx");
    if (!res.ok) {
      alert(t("employees.activeListExportErr"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `active-list-${todayBakuYmd()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function runBulkWidget() {
    if (!snapshot?.modules.hrFull) {
      setUpsellOpen(true);
      return;
    }
    window.localStorage.setItem("erafinanceAssistantBulkFlow", "emuqavile");
    window.localStorage.setItem("erafinanceAssistantBulkIds", JSON.stringify(selectedIds));
    alert("Bulk payload prepared for ERA Finance Assistant");
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("employees.title")}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              title={t("employees.activeListExportHint")}
              onClick={() => void exportActiveListExcel()}
            >
              {t("employees.activeListExport")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              onClick={runBulkWidget}
            >
              {t("bulk.employees.rpa")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              title={t("bulk.employees.exportHint", {
                defaultValue:
                  "Portal-result xlsx with employeeId rows for status return after manual upload",
              })}
              onClick={() => void exportBulkExcel()}
            >
              {t(
                "bulk.employees.exportXlsx",
                "Export portal-result xlsx",
              )}
            </button>
            <label
              className={SECONDARY_BUTTON_CLASS}
              title={t("bulk.employees.importHint", {
                defaultValue: "Import portal result (employeeId, status, error)",
              })}
            >
              {t(
                "bulk.employees.importXlsx",
                "Import portal result (employeeId,status,error)",
              )}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importBulkExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label
              className={SECONDARY_BUTTON_CLASS}
              title={t("employees.bulkSalaryHint")}
            >
              {t("employees.bulkSalaryImport")}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importContractSalaryCsv(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
              disabled={subReady && Boolean(snapshot?.quotas.employees.atLimit)}
              title={
                subReady && snapshot?.quotas.employees.atLimit
                  ? t("subscription.employeesLimitTooltip")
                  : undefined
              }
              onClick={() => setCreateOpen(true)}
            >
              + {t("employees.newBtn")}
            </button>
          </div>
        }
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <p className="m-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        {t(
          "employees.fileTypesHelp",
          "Queue CSV ≠ portal-result xlsx ≠ contract-salary CSV.",
        )}{" "}
        <Link href="/hr/emas-queue" className={LINK_ACCENT_CLASS}>
          {t("employees.emas.openQueue", "ƏMAS queue")}
        </Link>
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem]">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("employees.salaryFilter")}
            value={salaryFilter}
            onChange={(v) =>
              setSalaryFilter(String(v) === "missing" ? "missing" : "all")
            }
            options={salaryFilterOptions}
          />
        </div>
      </div>

      {salaryZeroCount > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t("employees.salaryZeroBanner", { count: salaryZeroCount })}{" "}
          <span className="text-[#7F8C8D]">{t("employees.bulkSalaryHint")}</span>
        </p>
      ) : null}

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && total > 0 && (
        <>
          <div className="md:hidden space-y-3">
            {visibleRows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm text-[13px] space-y-1"
              >
                <div className="font-semibold text-[#34495E]">
                  {formatAzEmployeeListName(r)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {isPendingFin(r) ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                      PENDING_FIN
                    </span>
                  ) : null}
                  {isSalaryZero(r) ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-900">
                      {t("employees.salaryZeroBadge")}
                    </span>
                  ) : null}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={(e) => toggleSelected(r.id, e.target.checked)}
                  />
                  {t("bulk.employees.select")}
                </label>
                <div className="text-[13px] text-[#34495E]">
                  {t("employees.thFin")}:{" "}
                  <span className="font-mono tabular-nums">{r.finCode}</span> ·{" "}
                  {r.kind === "CONTRACTOR"
                    ? t("employees.kindContractor")
                    : t("employees.kindEmployee")}
                </div>
                {r.voen && (
                  <div className="text-[13px] text-right font-mono tabular-nums">
                    {t("employees.thVoen")}: {r.voen}
                  </div>
                )}
                <div className="text-right font-mono tabular-nums">
                  {t("employees.thGross")}: {formatMoneyAzn(r.salary)}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 pt-2">
                  {renderRowActions(r)}
                </div>
              </div>
            ))}
          </div>
          <div className={`hidden md:block ${DATA_TABLE_VIEWPORT_CLASS}`}>
            <table className={`${DATA_TABLE_CLASS} min-w-[720px]`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("employees.thFin")}</th>
                  <th className={DATA_TABLE_TH_CENTER_CLASS}>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? rows.map((x) => x.id) : [])
                      }
                    />
                  </th>
                  <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("employees.thKind")}</th>
                  <th className={`hidden lg:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                    {t("employees.thVoen")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.thName")}</th>
                  <th className={`hidden xl:table-cell ${DATA_TABLE_TH_LEFT_CLASS}`}>
                    {t("employees.thPosition")}
                  </th>
                  <th className={`hidden lg:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                    {t("employees.thStart")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("employees.thGross")}</th>
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("teamPage.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <div className="flex flex-col items-end gap-1">
                        <span>{r.finCode}</span>
                        {isPendingFin(r) ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                            PENDING_FIN
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CENTER_CLASS}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => toggleSelected(r.id, e.target.checked)}
                      />
                    </td>
                    <td className={DATA_TABLE_TD_CENTER_CLASS}>
                      {r.kind === "CONTRACTOR"
                        ? t("employees.kindContractor")
                        : t("employees.kindEmployee")}
                    </td>
                    <td className={`hidden lg:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                      {r.voen ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>
                      {formatAzEmployeeListName(r)}
                    </td>
                    <td className={`hidden xl:table-cell ${DATA_TABLE_TD_CLASS}`}>
                      {r.jobPosition
                        ? `${r.jobPosition.department.name} — ${r.jobPosition.name}`
                        : "—"}
                    </td>
                    <td className={`hidden lg:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                      {String(r.startDate).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <div className="flex flex-col items-end gap-1">
                        <span>{formatMoneyAzn(r.salary)}</span>
                        {isSalaryZero(r) ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                            {t("employees.salaryZeroBadge")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                      <div className="flex items-center justify-end gap-1">
                        {renderRowActions(r)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && rows.length === 0 && !error && (
        <EmptyState title={t("employees.none")} description={t("employees.emptyHint")} />
      )}

      {!loading && (
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      <CreateEmployeeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
        quotaAtLimit={subReady && Boolean(snapshot?.quotas.employees.atLimit)}
      />
      <EditEmployeeModal
        open={Boolean(editEmployeeId)}
        employeeId={editEmployeeId}
        token={token}
        onClose={() => setEditEmployeeId(null)}
        onSaved={() => void load()}
      />
      <RpaUpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} moduleKey="hrFull" />
    </div>
  );
}
