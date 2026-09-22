"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Plus } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { billingPeriodKeyBaku } from "@era/satellite-kit/time";
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

type AbsenceDetail = {
  id: string;
  kind: string;
  status: string;
  startDate: string;
  endDate: string;
  note: string;
  rejectionReason?: string | null;
  person?: { displayName: string | null; accessDenied: boolean } | null;
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
  unnamed: string,
): string {
  const p = persons[globalPersonId];
  if (!p) return unnamed;
  if (p.displayName?.trim()) return p.displayName.trim();
  return p.accessDenied ? masked : unnamed;
}

export default function WorkforceAbsencesPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceAbsences");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [month, setMonth] = useState(() => billingPeriodKeyBaku());

  const [createOpen, setCreateOpen] = useState(false);
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [fEmploymentId, setFEmploymentId] = useState("");
  const [fKind, setFKind] = useState<"" | AbsenceKind>("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fNote, setFNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterEmploymentId, setFilterEmploymentId] = useState(
    () => searchParams.get("employmentId") ?? "",
  );
  const [filterKind, setFilterKind] = useState<"" | AbsenceKind>("");

  const detailId = searchParams.get("id") ?? "";
  const [detail, setDetail] = useState<AbsenceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const empId = searchParams.get("employmentId");
    if (empId != null) setFilterEmploymentId(empId);
  }, [searchParams]);

  const setDetailId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("id", id);
      else params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setRejectReason("");
    const res = await workforceFetch(`absences/${id}`);
    if (!res.ok) {
      setDetailError(`${res.status}`);
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    setDetail((await res.json()) as AbsenceDetail);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId || !detailId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(detailId);
  }, [ready, user?.organizationId, detailId, loadDetail]);

  async function openCreate() {
    setFKind("");
    setFEmploymentId("");
    setFStart("");
    setFEnd("");
    setFNote("");
    setFormError(null);
    setCreateOpen(true);
    const res = await workforceFetch("employments?status=ACTIVE");
    if (res.ok) {
      const data = (await res.json()) as {
        items: EmploymentRow[];
        persons?: ListResponse["persons"];
      };
      const items = data.items ?? [];
      setEmployments(items);
      if (data.persons) setPersons((p) => ({ ...p, ...data.persons }));
    }
  }

  async function submitAbsence(submit: boolean) {
    if (busy || !fEmploymentId || !fKind || !fStart || !fEnd) return;
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

  async function detailAction(path: string, body?: unknown) {
    if (!detailId) return;
    setDetailBusy(true);
    setDetailError(null);
    const res = await workforceFetch(path, {
      method: "POST",
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      setDetailError(await res.text());
      setDetailBusy(false);
      return;
    }
    await loadDetail(detailId);
    await load();
    setDetailBusy(false);
  }

  const employeeFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (seen.has(r.employmentId)) continue;
      seen.set(
        r.employmentId,
        personLabel(
          persons,
          r.employment.globalPersonId,
          t("maskedPerson"),
          tCommon("unnamedPerson"),
        ),
      );
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [rows, persons, t, tCommon]);

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

      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setMonth(billingPeriodKeyBaku());
          setFilterEmploymentId("");
          setFilterKind("");
        }}
      >
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("monthFilter")}
          <input
            type="month"
            className="mt-1 block rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterEmployee")}
          value={filterEmploymentId}
          onChange={(next) => setFilterEmploymentId(String(next))}
          options={employeeFilterOptions.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterKind")}
          value={filterKind}
          onChange={(next) => setFilterKind(String(next) as "" | AbsenceKind)}
          options={ABSENCE_KINDS.map((k) => ({
            value: k,
            label: t(`kind.${k}` as "kind.VACATION"),
          }))}
          emptyLabel={t("filterAll")}
        />
      </EraListFilterBar>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
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
              {paged.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {personLabel(
                        persons,
                        r.employment.globalPersonId,
                        t("maskedPerson"),
                        tCommon("unnamedPerson"),
                      )}
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
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("open")}
                        aria-label={t("open")}
                        onClick={() => setDetailId(r.id)}
                      >
                        <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || !fEmploymentId || !fKind || !fStart || !fEnd}
              onClick={() => void submitAbsence(false)}
            >
              {t("saveDraft")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !fEmploymentId || !fKind || !fStart || !fEnd}
              onClick={() => void submitAbsence(true)}
            >
              {busy ? t("busy") : t("submit")}
            </button>
          </div>
        }
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <CatalogField
            kind="ENTITY_REF"
            label={t("fieldEmployment")}
            value={fEmploymentId}
            onChange={(next) => setFEmploymentId(String(next))}
            options={employments.map((e) => ({
              value: e.id,
              label: `${personLabel(persons, e.globalPersonId, t("maskedPerson"), tCommon("unnamedPerson"))} (${e.status})`,
            }))}
            emptyLabel={tCommon("select")}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colKind")}
            value={fKind}
            onChange={(next) => setFKind(String(next) as AbsenceKind)}
            options={ABSENCE_KINDS.map((k) => ({
              value: k,
              label: t(`kind.${k}` as "kind.VACATION"),
            }))}
            emptyLabel={tCommon("select")}
          />
          <DatePicker
            label={t("fieldFrom")}
            value={fStart}
            onChange={setFStart}
            placeholder={tCommon("datePlaceholder")}
            required
            fluid
          />
          <DatePicker
            label={t("fieldTo")}
            value={fEnd}
            onChange={setFEnd}
            placeholder={tCommon("datePlaceholder")}
            required
            fluid
          />
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
        </form>
      </ModalShell>

      <ModalShell
        open={Boolean(detailId)}
        title={t("detailTitle")}
        subtitle=""
        onClose={() => setDetailId(null)}
        closeLabel={tCommon("close")}
      >
        {detailLoading ? (
          <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : !detail ? (
          <p className="text-sm text-red-700">{detailError ?? t("notFound")}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px]">
              <span className="font-semibold text-[#34495E]">{t("colPerson")}: </span>
              {detail.person?.displayName ??
                (detail.person?.accessDenied ? t("maskedPerson") : "—")}
            </p>
            <p className="text-[13px]">
              <span className="font-semibold text-[#34495E]">{t("colKind")}: </span>
              {t(`kind.${detail.kind}` as "kind.VACATION")}
            </p>
            <p className="text-[13px]">
              <span className="font-semibold text-[#34495E]">{t("colPeriod")}: </span>
              {String(detail.startDate).slice(0, 10)} — {String(detail.endDate).slice(0, 10)}
            </p>
            <p className="text-[13px]">
              <span className="font-semibold text-[#34495E]">{t("colStatus")}: </span>
              {t(`status.${detail.status}` as "status.DRAFT")}
            </p>
            {detail.note ? (
              <p className="text-[13px]">
                <span className="font-semibold text-[#34495E]">{t("fieldNote")}: </span>
                {detail.note}
              </p>
            ) : null}
            {detail.rejectionReason ? (
              <p className="text-[13px] text-red-700">{detail.rejectionReason}</p>
            ) : null}

            {detailError ? <p className="text-sm text-red-700">{detailError}</p> : null}

            <div className="flex flex-wrap gap-2 pt-2">
              {detail.status === "DRAFT" ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={detailBusy}
                  onClick={() => void detailAction(`absences/${detailId}/submit`)}
                >
                  {t("submit")}
                </button>
              ) : null}
              {detail.status === "SUBMITTED" ? (
                <>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={detailBusy}
                    onClick={() => void detailAction(`absences/${detailId}/approve`)}
                  >
                    {t("approve")}
                  </button>
                  <div className="w-full space-y-2">
                    <input
                      className="block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                      placeholder={t("rejectReasonPlaceholder")}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={detailBusy}
                      onClick={() =>
                        void detailAction(`absences/${detailId}/reject`, {
                          rejectionReason: rejectReason,
                        })
                      }
                    >
                      {t("reject")}
                    </button>
                  </div>
                </>
              ) : null}
              {detail.status === "APPROVED" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={detailBusy}
                  onClick={() => void detailAction(`absences/${detailId}/cancel`)}
                >
                  {t("cancel")}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </ModalShell>
    </>
  );
}
