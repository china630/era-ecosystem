"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogField } from "@era/satellite-kit/ui";
import { apiFetch } from "../../lib/api-client";
import { PageHeader } from "../../components/layout/page-header";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  LINK_ACCENT_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../lib/design-system";

type QueueItem = {
  id: string;
  employeeId: string;
  eventType: string;
  status: string;
  statusLabel?: string;
  salaryGrossAzn: string;
  finPending: boolean;
  finCode: string | null;
  displayName: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  positionTitle: string;
  departmentName: string | null;
  globalPersonId: string;
  cpEmploymentId: string | null;
  createdAt: string;
  submittedAt: string | null;
  submittedByUserId: string | null;
  submittedByEmail?: string | null;
  submittedByLabel?: string | null;
  mappingVersion: number;
  personnelOrderUrl: string | null;
};

type QueueResponse = {
  emasMode: string;
  mappingVersion: number;
  personnelOrdersUrl: string | null;
  portalUrl?: string;
  items: QueueItem[];
};

const STATUS_OPTIONS = [
  { value: "PENDING_MANUAL", label: "PENDING_MANUAL" },
  { value: "SUBMITTED_MANUAL", label: "SUBMITTED_MANUAL" },
  { value: "FAILED", label: "ERROR (FAILED)" },
  { value: "", label: "All manual" },
];

export default function EmasQueuePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING_MANUAL");
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label:
          o.value === ""
            ? t("employees.emas.filterAll", "All manual")
            : o.value === "FAILED"
              ? t("employees.emas.filterError", "ERROR (FAILED)")
              : o.label,
      })),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    const res = await apiFetch(`/api/hr/emas/queue${qs}`);
    if (!res.ok) {
      setError(t("employees.emas.queueLoadErr", "Failed to load ƏMAS queue"));
      setLoading(false);
      return;
    }
    setData((await res.json()) as QueueResponse);
    setLoading(false);
  }, [statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markSubmitted(id: string) {
    setBusyId(id);
    const res = await apiFetch(`/api/hr/emas/queue/${id}/mark-submitted`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteById[id]?.trim() || undefined }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError(t("employees.emas.markErr", "Could not mark as submitted"));
      return;
    }
    await load();
  }

  async function openPrefill(employeeId: string) {
    const res = await apiFetch(
      `/api/hr/employees/emas-prefill?employeeId=${employeeId}`,
    );
    if (!res.ok) {
      setError(t("employees.emas.prefillErr", "Prefill failed"));
      return;
    }
    const json = await res.json();
    if ("internalRate" in (json as object)) {
      setError("Prefill leaked internalRate — blocked");
      return;
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emas-prefill-${employeeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCsv() {
    const res = await apiFetch("/api/hr/emas/queue/export.csv");
    if (!res.ok) {
      setError(t("employees.emas.exportErr", "CSV export failed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emas-queue.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyEmployeeId(id: string) {
    void navigator.clipboard?.writeText(id);
  }

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t("employees.emas.queueTitle", "ƏMAS queue")}
        subtitle={t(
          "employees.emas.queueHint",
          "Primary Wave 7 path: manual portal upload per VÖEN. Contract salary only — never MGMT internal rate. S2S stays off until gateway is configured.",
        )}
      />

      <section className={`${CARD_CONTAINER_CLASS} space-y-3`}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {t("employees.emas.mode", "Mode")}:{" "}
            <strong>{data?.emasMode ?? "…"}</strong>
          </span>
          <span>mapping v{data?.mappingVersion ?? "—"}</span>
          <div className="min-w-[12rem]">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("employees.emas.statusFilter", "Status")}
              value={statusFilter}
              onChange={(next) => {
                const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                setStatusFilter(v);
              }}
              options={statusOptions}
            />
          </div>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("common.refresh", "Refresh")}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void downloadCsv()}>
            {t(
              "employees.emas.exportQueueCsv",
              "Download queue CSV (portal fill)",
            )}
          </button>
          {data?.portalUrl ? (
            <a
              className={PRIMARY_BUTTON_CLASS}
              href={data.portalUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("employees.emas.openPortal", "Open ƏMAS portal")}
            </a>
          ) : null}
          {data?.personnelOrdersUrl ? (
            <a
              className={SECONDARY_BUTTON_CLASS}
              href={data.personnelOrdersUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("employees.emas.openOrdersPdf", "Personnel orders")}
            </a>
          ) : null}
        </div>
        <p className="m-0 text-xs text-slate-600">
          {t(
            "employees.emas.queueCsvHelp",
            "Queue CSV = FIN/name/dates/contract salary for manual portal fill — not the employees portal-result xlsx, not contract-salary CSV.",
          )}{" "}
          <Link href="/employees" className={LINK_ACCENT_CLASS}>
            {t("employees.emas.queueCsvEmployeesLink", "Employees page")}
          </Link>
        </p>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {loading ? (
          <p className="text-sm">{t("common.loading", "Loading…")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thType", "Type")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thStatus", "Status")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thPerson", "Person / FIN")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thPosition", "Position")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thSalary", "Salary")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("employees.emas.thSubmitted", "Submitted")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.eventType}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.statusLabel ?? row.status}
                      <div className="text-xs text-slate-500">
                        {row.finPending ? "PENDING_FIN" : "READY"}
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.displayName ?? "—"}
                      <div className="text-xs text-slate-500">
                        {row.finCode ?? "—"}
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.positionTitle}
                      {row.departmentName ? ` · ${row.departmentName}` : ""}
                      <div className="text-xs text-slate-500">
                        {row.contractStartDate ?? ""}
                        {row.contractEndDate ? ` → ${row.contractEndDate}` : ""}
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {Number(String(row.salaryGrossAzn).replace(",", ".")) <= 0 ? (
                        <div className="space-y-1">
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                            {t("employees.emas.pendingSalaryBadge", "PENDING_SALARY")}
                          </span>
                          <p className="m-0 text-xs text-slate-600">
                            {t(
                              "employees.emas.pendingSalaryHint",
                              "Set contract salary on the employee card (never internalRate).",
                            )}{" "}
                            <Link href="/employees" className={LINK_ACCENT_CLASS}>
                              {t("employees.title", "Employees")}
                            </Link>
                          </p>
                        </div>
                      ) : (
                        row.salaryGrossAzn
                      )}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.submittedAt
                        ? new Date(row.submittedAt).toLocaleString()
                        : "—"}
                      {row.submittedByLabel ||
                      row.submittedByEmail ||
                      row.submittedByUserId ? (
                        <div className="text-xs text-slate-500">
                          {row.submittedByLabel ||
                            row.submittedByEmail ||
                            `${row.submittedByUserId!.slice(0, 8)}…`}
                        </div>
                      ) : null}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} space-y-2`}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => void openPrefill(row.employeeId)}
                        >
                          {t("employees.emas.prefillJson", "Prefill JSON")}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => copyEmployeeId(row.employeeId)}
                          title={row.employeeId}
                        >
                          {t("employees.emas.copyForExtension", "Copy ID for extension")}
                        </button>
                        {row.personnelOrderUrl ? (
                          <a
                            className={SECONDARY_BUTTON_CLASS}
                            href={row.personnelOrderUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("employees.emas.orderPdf", "Order PDF")}
                          </a>
                        ) : null}
                      </div>
                      {row.status === "PENDING_MANUAL" || row.status === "FAILED" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className={MODAL_INPUT_CLASS}
                            placeholder={t("employees.emas.notePlaceholder", "Optional note")}
                            value={noteById[row.id] ?? ""}
                            onChange={(e) =>
                              setNoteById((m) => ({ ...m, [row.id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            disabled={busyId === row.id}
                            onClick={() => void markSubmitted(row.id)}
                          >
                            {t("employees.emas.markSubmitted", "Marked in portal")}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!loading && (data?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <td className={DATA_TABLE_TD_CLASS} colSpan={7}>
                      {t("employees.emas.queueEmpty", "No events in this filter.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
