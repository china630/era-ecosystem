"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type AbsenceRow = {
  id: string;
  kind: string;
  status: string;
  startDate: string;
  endDate: string;
  note: string;
  employmentId: string;
  employment: { globalPersonId: string };
};

type EmploymentRow = { id: string; globalPersonId: string; status: string };

type ListResponse = {
  items: AbsenceRow[];
  persons: Record<
    string,
    { globalPersonId: string; displayName: string | null; accessDenied: boolean }
  >;
};

const ABSENCE_KINDS = [
  "VACATION",
  "SICK",
  "UNPAID",
  "SOCIAL_LEAVE",
  "EDUCATIONAL_LEAVE",
  "BUSINESS_TRIP",
  "ADMINISTRATIVE",
] as const;
type AbsenceKind = (typeof ABSENCE_KINDS)[number];

function personLabel(
  persons: ListResponse["persons"],
  globalPersonId: string,
  masked: string,
): string {
  const p = persons[globalPersonId];
  if (!p) return globalPersonId.slice(0, 8);
  if (p.displayName) return p.displayName;
  return p.accessDenied ? masked : globalPersonId.slice(0, 8);
}

export default function WorkforceAbsencesPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceAbsences");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [createOpen, setCreateOpen] = useState(false);
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [fEmploymentId, setFEmploymentId] = useState("");
  const [fKind, setFKind] = useState<AbsenceKind>("VACATION");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fNote, setFNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterEmploymentId, setFilterEmploymentId] = useState("");
  const [filterKind, setFilterKind] = useState<"" | AbsenceKind>("");

  const bounds = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      dateFrom: `${month}-01`,
      dateTo: `${month}-${String(last).padStart(2, "0")}`,
    };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams(bounds);
    const res = await workforceFetch(`absences?${qs.toString()}`);
    if (!res.ok) {
      if (await isWorkforceGate403(res)) {
        setNotEntitled(true);
        setRows([]);
        setLoading(false);
        return;
      }
      setError(`${res.status}`);
      setRows([]);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    const data = (await res.json()) as ListResponse;
    setRows(data.items ?? []);
    setPersons(data.persons ?? {});
    setLoading(false);
  }, [bounds]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function openCreate() {
    setFKind("VACATION");
    setFStart("");
    setFEnd("");
    setFNote("");
    setFormError(null);
    setCreateOpen(true);
    const res = await workforceFetch("employments?status=ACTIVE");
    if (res.ok) {
      const data = (await res.json()) as { items: EmploymentRow[] };
      const items = data.items ?? [];
      setEmployments(items);
      if (items[0]) setFEmploymentId(items[0].id);
    }
  }

  async function submitAbsence(submit: boolean) {
    if (busy || !fEmploymentId || !fStart || !fEnd) return;
    setBusy(true);
    setFormError(null);
    const res = await workforceFetch("absences", {
      method: "POST",
      body: JSON.stringify({
        employmentId: fEmploymentId,
        kind: fKind,
        startDate: fStart,
        endDate: fEnd,
        note: fNote,
        submit,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(await res.text());
      return;
    }
    setCreateOpen(false);
    await load();
  }

  const employeeFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (seen.has(r.employmentId)) continue;
      seen.set(
        r.employmentId,
        personLabel(persons, r.employment.globalPersonId, t("maskedPerson")),
      );
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [rows, persons, t]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (filterEmploymentId && r.employmentId !== filterEmploymentId) return false;
        if (filterKind && r.kind !== filterKind) return false;
        return true;
      }),
    [rows, filterEmploymentId, filterKind],
  );

  const { page, pageSize, setPage, setPageSize, paged, total } = useListPagination(
    filteredRows,
    `${filterEmploymentId}:${filterKind}:${month}`,
  );

  if (!ready) return null;
  if (!user?.organizationId) {
    return <p className="text-sm text-[#7F8C8D]">{t("selectOrg")}</p>;
  }
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("newAbsence")}
          </button>
        }
      />

      <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-center gap-3 p-4`}>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#34495E]">
          <span className="whitespace-nowrap">{t("monthFilter")}</span>
          <input
            type="month"
            className="rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#34495E]">
          <span className="whitespace-nowrap">{t("filterEmployee")}</span>
          <select
            className="min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterEmploymentId}
            onChange={(e) => setFilterEmploymentId(e.target.value)}
          >
            <option value="">{t("filterAll")}</option>
            {employeeFilterOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#34495E]">
          <span className="whitespace-nowrap">{t("filterKind")}</span>
          <select
            className="min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as "" | AbsenceKind)}
          >
            <option value="">{t("filterAll")}</option>
            {ABSENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}` as "kind.VACATION")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : filteredRows.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("empty")}</div>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colKind")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPeriod")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {personLabel(persons, r.employment.globalPersonId, t("maskedPerson"))}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {t(`kind.${r.kind}` as "kind.VACATION")}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} tabular-nums whitespace-nowrap`}>
                    {String(r.startDate).slice(0, 10)} — {String(r.endDate).slice(0, 10)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {t(`status.${r.status}` as "status.DRAFT")}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    <Link
                      href={`/workspace/workforce/absences/${r.id}`}
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      title={t("open")}
                      aria-label={t("open")}
                    >
                      <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        </div>
      )}

      <ModalShell
        open={createOpen}
        title={t("newTitle")}
        subtitle={t("newSubtitle")}
        onClose={() => setCreateOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldEmployment")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={fEmploymentId}
              onChange={(e) => setFEmploymentId(e.target.value)}
              required
            >
              {employments.map((e) => (
                <option key={e.id} value={e.id}>
                  {personLabel(persons, e.globalPersonId, e.id.slice(0, 8))} ({e.status})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colKind")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={fKind}
              onChange={(e) => setFKind(e.target.value as AbsenceKind)}
            >
              {ABSENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}` as "kind.VACATION")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldFrom")}
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={fStart}
                onChange={(e) => setFStart(e.target.value)}
                required
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldTo")}
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={fEnd}
                onChange={(e) => setFEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldNote")}
            <textarea
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              rows={3}
              value={fNote}
              onChange={(e) => setFNote(e.target.value)}
            />
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void submitAbsence(false)}
            >
              {t("saveDraft")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void submitAbsence(true)}
            >
              {busy ? t("busy") : t("submit")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
