"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

type PositionRow = {
  id: string;
  name: string;
  code: string | null;
  totalSlots: number;
  leadership?: boolean;
  tariffAzn?: string | number | null;
  defaultWorkRegime?: string | null;
  weeklyHours?: string | number | null;
  status?: string;
  jobId?: string | null;
  parentPositionId?: string | null;
  job?: { id: string; name: string } | null;
  orgUnit: { id: string; name: string };
  _count?: { employments: number };
};

type OrgUnit = { id: string; name: string; status?: string };
type JobOpt = { id: string; name: string; status?: string };

type EditState = { mode: "create" } | { mode: "edit"; row: PositionRow } | null;

export default function PositionsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforcePositions");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<PositionRow[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [formOrgUnitId, setFormOrgUnitId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formSlots, setFormSlots] = useState(1);
  const [formLeadership, setFormLeadership] = useState(false);
  const [formTariff, setFormTariff] = useState("");
  const [formRegime, setFormRegime] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formJobId, setFormJobId] = useState("");
  const [formParentPositionId, setFormParentPositionId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveRow, setArchiveRow] = useState<PositionRow | null>(null);

  const [filterOrgUnitId, setFilterOrgUnitId] = useState(
    () => searchParams.get("orgUnitId") ?? "",
  );
  const [filterStatus, setFilterStatus] = useState("ACTIVE");

  useEffect(() => {
    const ou = searchParams.get("orgUnitId");
    if (ou != null) setFilterOrgUnitId(ou);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (filterOrgUnitId) qs.set("orgUnitId", filterOrgUnitId);
    if (filterStatus) qs.set("status", filterStatus);
    const q = qs.toString();
    const [posRes, unitRes, jobsRes] = await Promise.all([
      wfFetch(`positions${q ? `?${q}` : ""}`),
      wfFetch("org-units"),
      wfFetch("jobs?status=ACTIVE"),
    ]);
    if (await isWorkforceGate403(posRes)) {
      setNotEntitled(true);
      setRows([]);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (unitRes.ok) {
      const u = (await unitRes.json()) as { items: OrgUnit[] };
      setUnits((u.items ?? []).filter((x) => (x.status ?? "ACTIVE") === "ACTIVE"));
    }
    if (jobsRes.ok) {
      const j = (await jobsRes.json()) as JobOpt[];
      setJobs(Array.isArray(j) ? j : []);
    }
    if (posRes.ok) {
      setRows(await posRes.json());
    } else {
      setError(await posRes.text());
      setRows([]);
    }
    setLoading(false);
  }, [filterOrgUnitId, filterStatus]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  function openCreate() {
    setFormOrgUnitId("");
    setFormName("");
    setFormCode("");
    setFormSlots(1);
    setFormLeadership(false);
    setFormTariff("");
    setFormRegime("");
    setFormHours("");
    setFormJobId("");
    setFormParentPositionId("");
    setFormError(null);
    setEditState({ mode: "create" });
  }

  function openEdit(row: PositionRow) {
    setFormOrgUnitId(row.orgUnit?.id ?? "");
    setFormName(row.name);
    setFormCode(row.code ?? "");
    setFormSlots(row.totalSlots);
    setFormLeadership(row.leadership === true);
    setFormTariff(row.tariffAzn != null ? String(row.tariffAzn) : "");
    setFormRegime(row.defaultWorkRegime ?? "");
    setFormHours(row.weeklyHours != null ? String(row.weeklyHours) : "");
    setFormJobId(row.jobId ?? row.job?.id ?? "");
    setFormParentPositionId(row.parentPositionId ?? "");
    setFormError(null);
    setEditState({ mode: "edit", row });
  }

  async function savePosition(e?: React.FormEvent) {
    e?.preventDefault();
    if (!editState || !formName.trim()) return;
    setBusy(true);
    setFormError(null);
    const jobPayload = {
      jobId: formJobId.trim() || null,
      parentPositionId: formParentPositionId.trim() || null,
    };
    const res =
      editState.mode === "create"
        ? await wfFetch("positions", {
            method: "POST",
            body: JSON.stringify({
              orgUnitId: formOrgUnitId,
              name: formName.trim(),
              code: formCode.trim() || null,
              totalSlots: formSlots,
              leadership: formLeadership,
              tariffAzn: formTariff.trim() ? Number(formTariff) : null,
              defaultWorkRegime: formRegime || null,
              weeklyHours: formHours.trim() ? Number(formHours) : null,
              ...jobPayload,
            }),
          })
        : await wfFetch(`positions/${editState.row.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: formName.trim(),
              code: formCode.trim() || null,
              totalSlots: formSlots,
              leadership: formLeadership,
              tariffAzn: formTariff.trim() ? Number(formTariff) : null,
              defaultWorkRegime: formRegime || null,
              weeklyHours: formHours.trim() ? Number(formHours) : null,
              ...jobPayload,
            }),
          });
    setBusy(false);
    if (!res.ok) {
      setFormError(await res.text());
      return;
    }
    setEditState(null);
    await load();
  }

  async function archivePosition(row: PositionRow) {
    setArchiveRow(row);
  }

  async function submitArchive(row: PositionRow) {
    setBusy(true);
    setError(null);
    const res = await wfFetch(`positions/${row.id}/archive`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.id, label: u.name })),
    [units],
  );

  const safeRows = Array.isArray(rows) ? rows : [];
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(safeRows);

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addPosition")}
            </button>
          }
        />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-700">{error}</p> : null}

      <EraListWorkspace
        filter={
      <EraListFilterBar
        className="!mb-0"
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setFilterOrgUnitId("");
          setFilterStatus("ACTIVE");
        }}
      >
        <CatalogField
          kind={unitOptions.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
          label={t("filterOrgUnit")}
          value={filterOrgUnitId}
          onChange={(next) => setFilterOrgUnitId(String(next))}
          options={unitOptions}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterStatus")}
          value={filterStatus}
          onChange={(next) => setFilterStatus(String(next))}
          options={[
            { value: "ACTIVE", label: t("statusActive") },
            { value: "ARCHIVED", label: t("statusArchived") },
          ]}
          emptyLabel={t("filterAll")}
        />
      </EraListFilterBar>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colTariff")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colSlots")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                    colSpan={7}
                  >
                    {loading ? t("loading") : t("empty")}
                  </td>
                </tr>
              ) : (
              paged.map((r) => {
                const filled = r._count?.employments ?? 0;
                const full = filled >= r.totalSlots;
                return (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.orgUnit?.name ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <Link
                        href={`/workspace/workforce/employments?positionId=${encodeURIComponent(r.id)}`}
                        className="text-[#2980B9] hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.code ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {(r.status ?? "ACTIVE") === "ARCHIVED"
                        ? t("statusArchived")
                        : t("statusActive")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                      {r.tariffAzn != null && r.tariffAzn !== "" ? String(r.tariffAzn) : "—"}
                      {r.leadership ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-[#7F8C8D]">
                          {t("fieldLeadership")}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums ${
                        full ? "font-semibold text-[#C0392B]" : ""
                      }`}
                    >
                      <Link
                        href={`/workspace/workforce/employments?positionId=${encodeURIComponent(r.id)}`}
                        className="hover:underline"
                      >
                        {filled} / {r.totalSlots}
                      </Link>
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      {(r.status ?? "ACTIVE") === "ACTIVE" ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("edit")}
                            aria-label={t("edit")}
                            onClick={() => openEdit(r)}
                          >
                            <Pencil
                              className="h-4 w-4 text-[#2980B9]"
                              aria-hidden
                            />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("archive")}
                            aria-label={t("archive")}
                            disabled={busy || filled > 0}
                            onClick={() => void archivePosition(r)}
                          >
                            <Archive
                              className="h-4 w-4 text-[#C0392B]"
                              aria-hidden
                            />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#95A5A6]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
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
        open={editState != null}
        title={editState?.mode === "edit" ? t("editTitle") : t("createTitle")}
        onClose={() => setEditState(null)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setEditState(null)}
            onSubmit={() => void savePosition()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <form onSubmit={(e) => void savePosition(e)} className="grid gap-3">
          <CatalogField
            kind={unitOptions.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
            label={t("fieldOrgUnit")}
            value={formOrgUnitId}
            onChange={(next) => setFormOrgUnitId(String(next))}
            options={unitOptions}
            required
            emptyLabel={tCommon("select")}
            disabled={editState?.mode === "edit"}
          />
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
            kind="ENTITY_REF"
            label={t("fieldJob")}
            value={formJobId}
            onChange={(next) => setFormJobId(String(next))}
            options={jobs.map((j) => ({ value: j.id, label: j.name }))}
            emptyLabel={t("jobEmpty")}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("fieldParentPosition")}
            value={formParentPositionId}
            onChange={(next) => setFormParentPositionId(String(next))}
            options={rows
              .filter(
                (r) =>
                  (r.status ?? "ACTIVE") === "ACTIVE" &&
                  (editState?.mode !== "edit" || r.id !== editState.row.id),
              )
              .map((r) => ({
                value: r.id,
                label: `${r.name} (${r.orgUnit?.name ?? "—"})`,
              }))}
            emptyLabel={t("parentPositionEmpty")}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldSlots")}
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formSlots}
              onChange={(e) => setFormSlots(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              checked={formLeadership}
              onChange={(e) => setFormLeadership(e.target.checked)}
            />
            {t("fieldLeadership")}
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldTariff")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              inputMode="decimal"
              value={formTariff}
              onChange={(e) => setFormTariff(e.target.value)}
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fieldRegime")}
            value={formRegime}
            onChange={(next) => setFormRegime(String(next))}
            options={["FIVE_DAY", "SIX_DAY", "MEDICAL", "CUSTOM"].map((value) => ({
              value,
              label: t(`regime.${value}` as "regime.FIVE_DAY"),
            }))}
            emptyLabel={t("regimeEmpty")}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldWeeklyHours")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              inputMode="decimal"
              value={formHours}
              onChange={(e) => setFormHours(e.target.value)}
            />
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        </form>
      </ModalShell>
      <WorkforceConfirmDialog
        open={archiveRow !== null}
        title={t("archiveConfirm", { name: archiveRow?.name ?? "" })}
        body={t("archiveConfirm", { name: archiveRow?.name ?? "" })}
        confirmLabel={tCommon("confirm")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        danger
        onCancel={() => setArchiveRow(null)}
        onConfirm={() => {
          const row = archiveRow;
          setArchiveRow(null);
          if (row) void submitArchive(row);
        }}
      />
    </div>
  );
}
