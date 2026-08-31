"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [employments, setEmployments] = useState<EmploymentOpt[]>([]);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [planYear, setPlanYear] = useState(new Date().getFullYear());
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(rows);

  const empOptions = useMemo(
    () =>
      employments.map((e) => ({
        value: e.id,
        label: persons[e.globalPersonId]?.displayName ?? e.globalPersonId.slice(0, 8),
      })),
    [employments, persons],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch(`vacation-plans?year=${year}`);
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
    setLoading(false);
  }, [year, t]);

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
      <div className={`${CARD_CONTAINER_CLASS} mb-0 flex flex-wrap items-center gap-3 p-4`}>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#34495E]">
          {t("year")}
          <input
            type="number"
            className="w-24 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
      </div>
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
                    <td className={`${DATA_TABLE_TD_CLASS} flex flex-wrap gap-2`}>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "DRAFT"}
                        onClick={() => void act(r.id, "submit")}
                      >
                        {t("submit")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "SUBMITTED"}
                        onClick={() => void act(r.id, "approve")}
                      >
                        {t("approve")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "SUBMITTED"}
                        onClick={() => void act(r.id, "reject")}
                      >
                        {t("reject")}
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
                <label className="block text-[13px] font-medium text-[#34495E]">
                  {t("startDate")}
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                    value={line.startDate}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, startDate: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </label>
                <label className="block text-[13px] font-medium text-[#34495E]">
                  {t("endDate")}
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                    value={line.endDate}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, endDate: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </label>
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
    </div>
  );
}
