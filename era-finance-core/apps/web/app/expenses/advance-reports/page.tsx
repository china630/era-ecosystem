"use client";

import { ExternalLink, Pencil, Plus, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { EmptyState } from "../../../components/empty-state";
import { PageHeader } from "../../../components/layout/page-header";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";

type EmployeeOpt = {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
};

type ReportRow = {
  id: string;
  reportDate: string;
  status: "DRAFT" | "POSTED";
  totalDeclared: unknown;
  currencyCode: string;
  purpose: string;
  employee?: EmployeeOpt;
  lineCount?: number;
};

type ExpenseLineForm = {
  amount: string;
  description: string;
  expenseAccountCode: string;
  vatRate: string;
  receiptUrl: string;
};

const emptyLine = (): ExpenseLineForm => ({
  amount: "",
  description: "",
  expenseAccountCode: "",
  vatRate: "18",
  receiptUrl: "",
});

function employeeLabel(e?: EmployeeOpt): string {
  if (!e) return "—";
  return (
    e.displayName?.trim() ||
    `${e.lastName ?? ""} ${e.firstName ?? ""}`.trim() ||
    e.id.slice(0, 8)
  );
}

function AdvanceReportsPageContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState("AZN");
  const [purpose, setPurpose] = useState("");
  const [cashOrderId, setCashOrderId] = useState("");
  const [lines, setLines] = useState<ExpenseLineForm[]>([emptyLine()]);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams({ pageSize: "50" });
    if (statusFilter) q.set("status", statusFilter);
    const res = await apiFetch(`/api/banking/cash/advance-reports?${q}`);
    if (!res.ok) {
      setErr(`${t("expenses.advanceReport.loadErr")}: ${res.status}`);
      setRows([]);
    } else {
      const data = (await res.json()) as { items: ReportRow[]; total: number };
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [token, statusFilter, t]);

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/banking/cash/accountable");
    if (res.ok) {
      const data = (await res.json()) as Array<{ employee: EmployeeOpt }>;
      setEmployees(data.map((x) => x.employee));
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
    void loadEmployees();
  }, [load, loadEmployees, ready, token]);

  function openCreate() {
    setEditId(null);
    setEmployeeId("");
    setReportDate(new Date().toISOString().slice(0, 10));
    setCurrencyCode("AZN");
    setPurpose("");
    setCashOrderId("");
    setLines([emptyLine()]);
    setDrawerOpen(true);
  }

  async function openEdit(id: string) {
    const res = await apiFetch(`/api/banking/cash/advance-reports/${id}`);
    if (!res.ok) {
      toast.error(t("expenses.advanceReport.loadErr"));
      return;
    }
    const row = (await res.json()) as {
      id: string;
      employeeId: string;
      reportDate: string;
      currencyCode: string;
      purpose: string;
      cashOrderId?: string | null;
      status: string;
      lines?: Array<{
        amount: unknown;
        description: string;
        expenseAccountCode: string;
        vatRate: unknown;
        receiptUrl?: string | null;
      }>;
    };
    if (row.status !== "DRAFT") {
      toast.error(t("expenses.advanceReport.notDraft"));
      return;
    }
    setEditId(row.id);
    setEmployeeId(row.employeeId);
    setReportDate(String(row.reportDate).slice(0, 10));
    setCurrencyCode(row.currencyCode || "AZN");
    setPurpose(row.purpose || "");
    setCashOrderId(row.cashOrderId ?? "");
    setLines(
      (row.lines ?? []).map((l) => ({
        amount: String(l.amount ?? ""),
        description: l.description ?? "",
        expenseAccountCode: l.expenseAccountCode ?? "",
        vatRate: String(l.vatRate ?? "18"),
        receiptUrl: l.receiptUrl ?? "",
      })),
    );
    if (!row.lines?.length) setLines([emptyLine()]);
    setDrawerOpen(true);
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    setSaving(true);
    const expenseLines = lines
      .map((x) => ({
        amount: Number(x.amount.replace(",", ".")),
        description: x.description.trim(),
        expenseAccountCode: x.expenseAccountCode.trim() || undefined,
        vatRate: Number(x.vatRate),
        receiptUrl: x.receiptUrl.trim() || undefined,
      }))
      .filter((x) => x.amount > 0 && x.description);
    const body = {
      employeeId,
      reportDate,
      currencyCode,
      purpose: purpose.trim() || undefined,
      cashOrderId: cashOrderId.trim() || undefined,
      expenseLines,
    };
    const res = await apiFetch(
      editId
        ? `/api/banking/cash/advance-reports/${editId}`
        : "/api/banking/cash/advance-reports",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(t("expenses.advanceReport.saveErr"));
      return;
    }
    toast.success(t("expenses.advanceReport.saved"));
    setDrawerOpen(false);
    await load();
  }

  async function postReport(id: string) {
    setSaving(true);
    const res = await apiFetch(`/api/banking/cash/advance-reports/${id}/post`, {
      method: "POST",
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(t("expenses.advanceReport.postErr"));
      return;
    }
    toast.success(t("expenses.advanceReport.posted"));
    await load();
  }

  function printReport(id: string) {
    window.open(`/api/banking/cash/advance-reports/${id}/print`, "_blank", "noopener,noreferrer");
  }

  const totalLabel = useMemo(() => `${total}`, [total]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <SubscriptionPaywall module="kassaPro">
      <div className="space-y-6">
        <PageHeader
          title={t("expenses.advanceReport.pageTitle")}
          subtitle={t("expenses.advanceReport.subtitle")}
        />

        <div className="flex flex-wrap items-center gap-3">
          <select
            className={MODAL_INPUT_CLASS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t("expenses.advanceReport.filterStatus")}
          >
            <option value="">{t("expenses.advanceReport.allStatuses")}</option>
            <option value="DRAFT">{t("expenses.advanceReport.statusDraft")}</option>
            <option value="POSTED">{t("expenses.advanceReport.statusPosted")}</option>
          </select>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1 inline h-4 w-4" />
            {t("expenses.advanceReport.newBtn")}
          </button>
          <span className="text-sm text-[#7F8C8D]">
            {t("expenses.advanceReport.totalCount", { count: totalLabel })}
          </span>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {loading ? (
          <p className="text-sm text-gray-600">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title={t("expenses.advanceReport.emptyTitle")}
            description={t("expenses.advanceReport.emptyHint")}
          />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("expenses.advanceReport.colDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("expenses.advanceReport.colEmployee")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("expenses.advanceReport.colPurpose")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("expenses.advanceReport.colAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("expenses.advanceReport.colStatus")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{String(r.reportDate).slice(0, 10)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{employeeLabel(r.employee)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.purpose || "—"}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {formatMoneyAzn(r.totalDeclared)} {r.currencyCode}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.status === "POSTED"
                        ? t("expenses.advanceReport.statusPosted")
                        : t("expenses.advanceReport.statusDraft")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("expenses.advanceReport.print")}
                        onClick={() => printReport(r.id)}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {r.status === "DRAFT" ? (
                        <>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("common.edit")}
                            onClick={() => void openEdit(r.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={`${SECONDARY_BUTTON_CLASS} ml-2 inline-flex h-8 items-center px-2 text-xs`}
                            disabled={saving}
                            onClick={() => void postReport(r.id)}
                          >
                            {t("expenses.advanceReport.postBtn")}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
            <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
              <div className="border-b border-[#E5E8EB] px-5 py-4">
                <h2 className="text-lg font-semibold text-[#2C3E50]">
                  {editId
                    ? t("expenses.advanceReport.editTitle")
                    : t("expenses.advanceReport.newTitle")}
                </h2>
              </div>
              <form className="flex flex-1 flex-col overflow-hidden" onSubmit={(e) => void saveDraft(e)}>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>
                      {t("expenses.advanceReport.employee")}
                    </span>
                    <select
                      className={`${MODAL_INPUT_CLASS} w-full`}
                      required
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    >
                      <option value="">{t("expenses.advanceReport.selectEmployee")}</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {employeeLabel(e)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("expenses.advanceReport.reportDate")}</span>
                    <input
                      type="date"
                      className={`${MODAL_INPUT_CLASS} w-full`}
                      required
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("expenses.advanceReport.currency")}</span>
                    <select
                      className={`${MODAL_INPUT_CLASS} w-full`}
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value)}
                    >
                      {["AZN", "USD", "EUR", "RUB", "TRY", "GBP"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("expenses.advanceReport.cashOrderId")}</span>
                    <input
                      className={`${MODAL_INPUT_CLASS} w-full`}
                      value={cashOrderId}
                      onChange={(e) => setCashOrderId(e.target.value)}
                      placeholder={t("expenses.advanceReport.cashOrderIdPh")}
                    />
                  </label>
                  <label className="block">
                    <span className={MODAL_FIELD_LABEL_CLASS}>{t("expenses.advanceReport.purpose")}</span>
                    <input
                      className={`${MODAL_INPUT_CLASS} w-full`}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </label>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={MODAL_FIELD_LABEL_CLASS}>{t("expenses.advanceReport.lines")}</span>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => setLines((prev) => [...prev, emptyLine()])}
                      >
                        {t("expenses.advanceReport.addLine")}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {lines.map((line, idx) => (
                        <div key={idx} className="rounded-lg border border-[#E5E8EB] p-3 space-y-2">
                          <input
                            className={`${MODAL_INPUT_CLASS} w-full`}
                            placeholder={t("expenses.advanceReport.lineDescription")}
                            value={line.description}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, description: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className={MODAL_INPUT_CLASS}
                              placeholder={t("expenses.advanceReport.lineAmount")}
                              value={line.amount}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, amount: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <input
                              className={MODAL_INPUT_CLASS}
                              placeholder={t("expenses.advanceReport.expenseAccount")}
                              value={line.expenseAccountCode}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, expenseAccountCode: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <input
                            className={`${MODAL_INPUT_CLASS} w-full`}
                            placeholder={t("expenses.advanceReport.receiptUrl")}
                            value={line.receiptUrl}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, receiptUrl: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-[#E5E8EB] px-5 py-4">
                  <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={saving}>
                    {t("expenses.advanceReport.saveDraft")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {t("common.cancel")}
                  </button>
                  <a
                    href="/banking/cash"
                    className="ml-auto inline-flex items-center text-sm text-[#2980B9] hover:underline"
                  >
                    {t("expenses.advanceReport.linkCash")}
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </SubscriptionPaywall>
  );
}

export default function AdvanceReportsPage() {
  return <AdvanceReportsPageContent />;
}
