"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Pencil, Plus } from "lucide-react";
import {
  CatalogField,
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
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type PositionRow = {
  id: string;
  name: string;
  code: string | null;
  totalSlots: number;
  status?: string;
  orgUnit: { id: string; name: string };
  _count?: { employments: number };
};

type OrgUnit = { id: string; name: string; status?: string };

type EditState = { mode: "create" } | { mode: "edit"; row: PositionRow } | null;

export default function PositionsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforcePositions");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<PositionRow[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [formOrgUnitId, setFormOrgUnitId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formSlots, setFormSlots] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

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
    const [posRes, unitRes] = await Promise.all([
      wfFetch(`positions${q ? `?${q}` : ""}`),
      wfFetch("org-units"),
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
    setFormOrgUnitId(filterOrgUnitId || units[0]?.id || "");
    setFormName("");
    setFormCode("");
    setFormSlots(1);
    setFormError(null);
    setEditState({ mode: "create" });
  }

  function openEdit(row: PositionRow) {
    setFormOrgUnitId(row.orgUnit?.id ?? "");
    setFormName(row.name);
    setFormCode(row.code ?? "");
    setFormSlots(row.totalSlots);
    setFormError(null);
    setEditState({ mode: "edit", row });
  }

  async function savePosition(e: React.FormEvent) {
    e.preventDefault();
    if (!editState || !formName.trim()) return;
    setBusy(true);
    setFormError(null);
    const res =
      editState.mode === "create"
        ? await wfFetch("positions", {
            method: "POST",
            body: JSON.stringify({
              orgUnitId: formOrgUnitId,
              name: formName.trim(),
              code: formCode.trim() || null,
              totalSlots: formSlots,
            }),
          })
        : await wfFetch(`positions/${editState.row.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: formName.trim(),
              code: formCode.trim() || null,
              totalSlots: formSlots,
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
    if (!window.confirm(t("archiveConfirm", { name: row.name }))) return;
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
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addPosition")}
          </button>
        }
      />

      <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-3 p-4`}>
        <CatalogField
          kind="ENTITY_REF"
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
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colSlots")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
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
              })}
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
        open={editState != null}
        title={editState?.mode === "edit" ? t("editTitle") : t("createTitle")}
        onClose={() => setEditState(null)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void savePosition(e)} className="grid gap-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("fieldOrgUnit")}
            value={formOrgUnitId}
            onChange={(next) => setFormOrgUnitId(String(next))}
            options={unitOptions}
            required
            emptyLabel={null}
            disabled={editState?.mode === "edit"}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldName")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldCode")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
            />
          </label>
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
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setEditState(null)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {busy ? tCommon("loading") : tCommon("save")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
