"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MoreHorizontal, Plus, Send, Trash2, X } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { bakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type PlanRow = {
  id: string;
  year: number;
  status: string;
  orgUnit?: { name: string } | null;
  lines: Array<{
    employmentId: string;
    startDate: string;
    endDate: string;
    days: number;
    employment: { globalPersonId: string };
  }>;
};

type EmploymentOpt = { id: string; globalPersonId: string };
type OrgUnitOpt = { id: string; name: string; status?: string };
type LineDraft = {
  key: string;
  employmentId: string;
  startDate: string;
  endDate: string;
  days: string;
};

function emptyLine(employmentId = ""): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employmentId,
    startDate: "",
    endDate: "",
    days: "14",
  };
}

export default function VacationPlansPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceVacation");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(() => bakuYmd().y);
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [employments, setEmployments] = useState<EmploymentOpt[]>([]);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [planYear, setPlanYear] = useState(() => bakuYmd().y);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [confirmAct, setConfirmAct] = useState<{
    id: string;
    action: "submit" | "approve" | "reject";
  } | null>(null);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    if (!filterStatus) return rows;
    return rows.filter((r) => r.status === filterStatus);
  }, [rows, filterStatus]);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(visibleRows, `${year}|${filterOrgUnitId}|${filterStatus}`);

  useEffect(() => {
    if (!moreMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-vacation-more-menu]")) return;
      setMoreMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreMenuId]);

  const empOptions = useMemo(
    () =>
      employments.map((e) => ({
        value: e.id,
        label: persons[e.globalPersonId]?.displayName ?? tCommon("unnamedPerson"),
      })),
    [employments, persons, tCommon],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ year: String(year) });
    if (filterOrgUnitId) qs.set("orgUnitId", filterOrgUnitId);
    const [res, unitRes] = await Promise.all([
      workforceFetch(`vacation-plans?${qs.toString()}`),
      workforceFetch("org-units"),
    ]);
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as
      | PlanRow[]
      | { items?: PlanRow[]; persons?: Record<string, { displayName: string | null }> };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    if (!Array.isArray(data) && data.persons) setPersons(data.persons);
    if (unitRes.ok) {
      const u = (await unitRes.json()) as { items?: OrgUnitOpt[] } | OrgUnitOpt[];
      const list = Array.isArray(u) ? u : (u.items ?? []);
      setOrgUnits(list.filter((x) => x.status !== "ARCHIVED"));
    }
    setLoading(false);
  }, [year, filterOrgUnitId, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function openCreate() {
    setPlanYear(year);
    setOrgUnitId("");
    setLines([emptyLine()]);
    setOpen(true);
    const [unitRes, empRes] = await Promise.all([
      workforceFetch("org-units"),
      workforceFetch("employments?status=ACTIVE"),
    ]);
    if (unitRes.ok) {
      const u = (await unitRes.json()) as { items?: OrgUnitOpt[] } | OrgUnitOpt[];
      const list = Array.isArray(u) ? u : (u.items ?? []);
      setOrgUnits(list.filter((x) => x.status !== "ARCHIVED"));
    }
    if (empRes.ok) {
      const e = (await empRes.json()) as {
        items?: EmploymentOpt[];
        persons?: Record<string, { displayName: string | null }>;
      };
      setEmployments(e.items ?? []);
      if (e.persons) setPersons((p) => ({ ...p, ...e.persons }));
      if (e.items?.[0]) {
        setLines([emptyLine(e.items[0].id)]);
      }
    }
  }

  async function createPlan() {
    const payloadLines = lines
      .filter((l) => l.employmentId && l.startDate && l.endDate)
      .map((l) => ({
        employmentId: l.employmentId,
        startDate: l.startDate,
        endDate: l.endDate,
        days: Number(l.days) || 1,
      }));
    if (payloadLines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("vacation-plans", {
        method: "POST",
        body: JSON.stringify({
          year: planYear,
          orgUnitId: orgUnitId || undefined,
          lines: payloadLines,
        }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "submit" | "approve" | "reject") {
    setBusy(true);
    setConfirmAct(null);
    setError(null);
    try {
      const res = await workforceFetch(`vacation-plans/${id}/${action}`, {
        method: "POST",
        body:
          action === "reject"
            ? JSON.stringify({ rejectionReason: "rejected" })
            : "{}",
      });
      if (!res.ok) {
        setError(t("actionFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("create")}
          </button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setYear(bakuYmd().y);
          setFilterOrgUnitId("");
          setFilterStatus("");
        }}
      >
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("year")}
          <input
            type="number"
            className="mt-1 block w-24 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <CatalogField
          kind="ENTITY_REF"
          label={t("colOrgUnit")}
          value={filterOrgUnitId}
          onChange={(next) => setFilterOrgUnitId(String(next))}
          options={orgUnits.map((u) => ({ value: u.id, label: u.name }))}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colStatus")}
          value={filterStatus}
          onChange={(next) => setFilterStatus(String(next))}
          options={["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((v) => ({
            value: v,
            label: t(`status.${v}` as "status.DRAFT"),
          }))}
          emptyLabel={t("filterAll")}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colYear")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLines")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
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
                    <td className={DATA_TABLE_TD_CLASS}>{r.year}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.orgUnit?.name ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.lines?.length ?? 0}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`status.${r.status}` as "status.DRAFT")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="relative flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("submit")}
                          aria-label={t("submit")}
                          disabled={busy || r.status !== "DRAFT"}
                          onClick={() =>
                            setConfirmAct({ id: r.id, action: "submit" })
                          }
                        >
                          <Send className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("approve")}
                          aria-label={t("approve")}
                          disabled={busy || r.status !== "SUBMITTED"}
                          onClick={() =>
                            setConfirmAct({ id: r.id, action: "approve" })
                          }
                        >
                          <Check className="h-4 w-4 text-[#27AE60]" aria-hidden />
                        </button>
                        <div className="relative" data-vacation-more-menu="">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("moreActions")}
                            aria-label={t("moreActions")}
                            disabled={busy}
                            onClick={() =>
                              setMoreMenuId((id) => (id === r.id ? null : r.id))
                            }
                          >
                            <MoreHorizontal
                              className="h-4 w-4 text-[#7F8C8D]"
                              aria-hidden
                            />
                          </button>
                          {moreMenuId === r.id ? (
                            <div className="absolute right-0 z-10 mt-1 min-w-[11rem] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-md">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#34495E] hover:bg-[#F4F6F7] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={busy || r.status !== "SUBMITTED"}
                                onClick={() => {
                                  setMoreMenuId(null);
                                  setConfirmAct({ id: r.id, action: "reject" });
                                }}
                              >
                                <X className="h-3.5 w-3.5 text-[#C0392B]" aria-hidden />
                                {t("reject")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
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
        open={open}
        title={t("createTitle")}
        onClose={() => setOpen(false)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-2xl"
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("year")}
            <input
              type="number"
              className="mt-1 block w-28 rounded-lg border border-[#D5DADF] px-2 py-1.5"
              value={planYear}
              onChange={(e) => setPlanYear(Number(e.target.value))}
            />
          </label>
          <CatalogField
            kind="ENTITY_REF"
            label={t("colOrgUnit")}
            value={orgUnitId}
            onChange={(next) => setOrgUnitId(String(next))}
            options={orgUnits.map((u) => ({ value: u.id, label: u.name }))}
            emptyLabel={t("filterAll")}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[13px] font-medium text-[#34495E]">{t("linesTitle")}</p>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setLines((prev) => [...prev, emptyLine(employments[0]?.id ?? "")])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("addLine")}
              </button>
            </div>
            {lines.map((line, idx) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-[#D5DADF] p-3 sm:grid-cols-2"
              >
                <CatalogField
                  kind="ENTITY_REF"
                  label={t("batchEmployee")}
                  value={line.employmentId}
                  onChange={(next) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, employmentId: String(next) } : l,
                      ),
                    )
                  }
                  options={empOptions}
                />
                <label className="block text-[13px] font-medium text-[#34495E]">
                  {t("days")}
                  <input
                    className="mt-1 block w-24 rounded-lg border border-[#D5DADF] px-2 py-1.5"
                    value={line.days}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, days: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </label>
                <DatePicker
                  label={t("startDate")}
                  value={line.startDate}
                  onChange={(iso) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, startDate: iso } : l,
                      ),
                    )
                  }
                  placeholder={tCommon("datePlaceholder")}
                  fluid
                />
                <DatePicker
                  label={t("endDate")}
                  value={line.endDate}
                  onChange={(iso) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, endDate: iso } : l,
                      ),
                    )
                  }
                  placeholder={tCommon("datePlaceholder")}
                  fluid
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className={`${SECONDARY_BUTTON_CLASS} sm:col-span-2`}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {t("removeLine")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={
              busy ||
              !lines.some((l) => l.employmentId && l.startDate && l.endDate)
            }
            onClick={() => void createPlan()}
          >
            {t("create")}
          </button>
        </form>
      </ModalShell>

      <ModalShell
        open={confirmAct != null}
        title={
          confirmAct?.action === "approve"
            ? t("approve")
            : confirmAct?.action === "reject"
              ? t("reject")
              : t("submit")
        }
        onClose={() => setConfirmAct(null)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-sm"
        footer={
          <ModalFooter
            onCancel={() => setConfirmAct(null)}
            onSubmit={() => {
              if (confirmAct) void act(confirmAct.id, confirmAct.action);
            }}
            cancelLabel={tCommon("cancel")}
            submitLabel={
              confirmAct?.action === "approve"
                ? t("approve")
                : confirmAct?.action === "reject"
                  ? t("reject")
                  : t("submit")
            }
            busy={busy}
          />
        }
      >
        <p className="text-sm text-[#34495E]">
          {confirmAct?.action === "approve"
            ? t("confirmApprove")
            : confirmAct?.action === "reject"
              ? t("confirmReject")
              : t("confirmSubmit")}
        </p>
      </ModalShell>
    </div>
  );
}
