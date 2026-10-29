"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Pencil, Plus } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";
import { WorkforceConfirmDialog } from "../../../../components/workspace/workforce-confirm-dialog";

type GradeRow = {
  id: string;
  code: string;
  name: string;
  level: number;
  status: string;
};

type JobRow = {
  id: string;
  name: string;
  code: string | null;
  jobFamily: string | null;
  gradeId: string | null;
  status: string;
  grade?: { id: string; code: string; name: string; level: number } | null;
};

type Tab = "grades" | "jobs";

export default function JobArchitecturePage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceJobArchitecture");
  const tCommon = useTranslations("common");

  const [tab, setTab] = useState<Tab>("grades");
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [filterQ, setFilterQ] = useState("");

  const [gradeEdit, setGradeEdit] = useState<
    { mode: "create" } | { mode: "edit"; row: GradeRow } | null
  >(null);
  const [jobEdit, setJobEdit] = useState<
    { mode: "create" } | { mode: "edit"; row: JobRow } | null
  >(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formLevel, setFormLevel] = useState("1");
  const [formJobFamily, setFormJobFamily] = useState("");
  const [formGradeId, setFormGradeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveGrade, setArchiveGrade] = useState<GradeRow | null>(null);
  const [archiveJob, setArchiveJob] = useState<JobRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : "";
    const [gRes, jRes] = await Promise.all([
      wfFetch(`grades${qs}`),
      wfFetch(`jobs${qs}`),
    ]);
    if (await isWorkforceGate403(gRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (gRes.ok) {
      const g = (await gRes.json()) as GradeRow[];
      setGrades(Array.isArray(g) ? g : []);
    } else {
      setError(await gRes.text());
      setGrades([]);
    }
    if (jRes.ok) {
      const j = (await jRes.json()) as JobRow[];
      setJobs(Array.isArray(j) ? j : []);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  const filteredGrades = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return grades;
    return grades.filter(
      (g) =>
        g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q),
    );
  }, [grades, filterQ]);

  const filteredJobs = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        (j.code ?? "").toLowerCase().includes(q) ||
        (j.jobFamily ?? "").toLowerCase().includes(q),
    );
  }, [jobs, filterQ]);

  const list: Array<GradeRow | JobRow> =
    tab === "grades" ? filteredGrades : filteredJobs;
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination<GradeRow | JobRow>(list);

  function openCreateGrade() {
    setFormCode("");
    setFormName("");
    setFormLevel("1");
    setFormError(null);
    setGradeEdit({ mode: "create" });
  }

  function openEditGrade(row: GradeRow) {
    setFormCode(row.code);
    setFormName(row.name);
    setFormLevel(String(row.level));
    setFormError(null);
    setGradeEdit({ mode: "edit", row });
  }

  function openCreateJob() {
    setFormCode("");
    setFormName("");
    setFormJobFamily("");
    setFormGradeId("");
    setFormError(null);
    setJobEdit({ mode: "create" });
  }

  function openEditJob(row: JobRow) {
    setFormCode(row.code ?? "");
    setFormName(row.name);
    setFormJobFamily(row.jobFamily ?? "");
    setFormGradeId(row.gradeId ?? row.grade?.id ?? "");
    setFormError(null);
    setJobEdit({ mode: "edit", row });
  }

  async function saveGrade(e?: React.FormEvent) {
    e?.preventDefault();
    if (!gradeEdit || !formName.trim() || !formCode.trim()) return;
    setBusy(true);
    setFormError(null);
    const body = {
      code: formCode.trim(),
      name: formName.trim(),
      level: Number(formLevel),
    };
    const res =
      gradeEdit.mode === "create"
        ? await wfFetch("grades", { method: "POST", body: JSON.stringify(body) })
        : await wfFetch(`grades/${gradeEdit.row.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
    setBusy(false);
    if (!res.ok) {
      setFormError(await res.text());
      return;
    }
    setGradeEdit(null);
    await load();
  }

  async function saveJob(e?: React.FormEvent) {
    e?.preventDefault();
    if (!jobEdit || !formName.trim()) return;
    setBusy(true);
    setFormError(null);
    const body = {
      name: formName.trim(),
      code: formCode.trim() || null,
      jobFamily: formJobFamily.trim() || null,
      gradeId: formGradeId.trim() || null,
    };
    const res =
      jobEdit.mode === "create"
        ? await wfFetch("jobs", { method: "POST", body: JSON.stringify(body) })
        : await wfFetch(`jobs/${jobEdit.row.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
    setBusy(false);
    if (!res.ok) {
      setFormError(await res.text());
      return;
    }
    setJobEdit(null);
    await load();
  }

  async function submitArchiveGrade(row: GradeRow) {
    setBusy(true);
    const res = await wfFetch(`grades/${row.id}/archive`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    setArchiveGrade(null);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  async function submitArchiveJob(row: JobRow) {
    setBusy(true);
    const res = await wfFetch(`jobs/${row.id}/archive`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    setArchiveJob(null);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate onEnabled={load} />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          tab === "grades" ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateGrade}>
              <Plus className="h-4 w-4" />
              {t("addGrade")}
            </button>
          ) : (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateJob}>
              <Plus className="h-4 w-4" />
              {t("addJob")}
            </button>
          )
        }
      />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 flex gap-2">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("tab")}
          value={tab}
          onChange={(next) => {
            setTab(String(next) === "jobs" ? "jobs" : "grades");
            setPage(1);
          }}
          options={[
            { value: "grades", label: t("tabGrades") },
            { value: "jobs", label: t("tabJobs") },
          ]}
        />
      </div>

      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tCommon("filterReset")}
            onReset={() => {
              setFilterQ("");
              setFilterStatus("ACTIVE");
            }}
          >
            <CatalogField
              kind="FREE_TEXT"
              label={t("filterSearch")}
              value={filterQ}
              onChange={(next) => setFilterQ(String(next))}
              options={[]}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("colStatus")}
              value={filterStatus}
              onChange={(next) => setFilterStatus(String(next))}
              options={[
                { value: "ACTIVE", label: t("statusActive") },
                { value: "ARCHIVED", label: t("statusArchived") },
              ]}
              emptyLabel={t("statusAll")}
            />
          </EraListFilterBar>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                {tab === "grades" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLevel")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
                  </>
                ) : (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFamily")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colGrade")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                    colSpan={tab === "grades" ? 5 : 6}
                  >
                    {loading ? t("loading") : t("empty")}
                  </td>
                </tr>
              ) : tab === "grades" ? (
                (paged as GradeRow[]).map((g) => (
                  <tr key={g.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{g.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{g.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{g.level}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {g.status === "ACTIVE" ? t("statusActive") : t("statusArchived")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        onClick={() => openEditGrade(g)}
                        aria-label={tCommon("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {g.status === "ACTIVE" ? (
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          onClick={() => setArchiveGrade(g)}
                          aria-label={t("archive")}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                (paged as JobRow[]).map((j) => (
                  <tr key={j.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{j.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{j.code ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{j.jobFamily ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {j.grade
                        ? `${j.grade.code} · ${j.grade.name}`
                        : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {j.status === "ACTIVE" ? t("statusActive") : t("statusArchived")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        onClick={() => openEditJob(j)}
                        aria-label={tCommon("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {j.status === "ACTIVE" ? (
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          onClick={() => setArchiveJob(j)}
                          aria-label={t("archive")}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        }
        footer={
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
        }
      />

      <ModalShell
        open={gradeEdit != null}
        title={gradeEdit?.mode === "edit" ? t("editGrade") : t("createGrade")}
        onClose={() => setGradeEdit(null)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setGradeEdit(null)}
            onSubmit={() => void saveGrade()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <form onSubmit={(e) => void saveGrade(e)} className="grid gap-3">
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldCode")}
            value={formCode}
            onChange={(next) => setFormCode(String(next))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldName")}
            value={formName}
            onChange={(next) => setFormName(String(next))}
            options={[]}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldLevel")}
            <input
              type="number"
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formLevel}
              onChange={(e) => setFormLevel(e.target.value)}
            />
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        </form>
      </ModalShell>

      <ModalShell
        open={jobEdit != null}
        title={jobEdit?.mode === "edit" ? t("editJob") : t("createJob")}
        onClose={() => setJobEdit(null)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setJobEdit(null)}
            onSubmit={() => void saveJob()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <form onSubmit={(e) => void saveJob(e)} className="grid gap-3">
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldName")}
            value={formName}
            onChange={(next) => setFormName(String(next))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldCode")}
            value={formCode}
            onChange={(next) => setFormCode(String(next))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldFamily")}
            value={formJobFamily}
            onChange={(next) => setFormJobFamily(String(next))}
            options={[]}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("fieldGrade")}
            value={formGradeId}
            onChange={(next) => setFormGradeId(String(next))}
            options={grades
              .filter((g) => g.status === "ACTIVE")
              .map((g) => ({
                value: g.id,
                label: `${g.code} · ${g.name} (L${g.level})`,
              }))}
            emptyLabel={t("gradeEmpty")}
          />
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        </form>
      </ModalShell>

      <WorkforceConfirmDialog
        open={archiveGrade != null}
        title={t("archiveGradeTitle")}
        body={archiveGrade ? t("archiveGradeMsg", { name: archiveGrade.name }) : ""}
        confirmLabel={t("archive")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setArchiveGrade(null)}
        onConfirm={() => archiveGrade && void submitArchiveGrade(archiveGrade)}
      />
      <WorkforceConfirmDialog
        open={archiveJob != null}
        title={t("archiveJobTitle")}
        body={archiveJob ? t("archiveJobMsg", { name: archiveJob.name }) : ""}
        confirmLabel={t("archive")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setArchiveJob(null)}
        onConfirm={() => archiveJob && void submitArchiveJob(archiveJob)}
      />
    </div>
  );
}
