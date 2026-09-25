"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Archive } from "lucide-react";
import {
  CatalogField,
  EraDataGrid,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseOrgUnitItems,
  parseWorkforceApiError,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";
import { WorkforceConfirmDialog } from "../../../../components/workspace/workforce-confirm-dialog";

type PlaceRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  responsibleOrgUnitId: string | null;
};

type OrgUnit = { id: string; name: string; status?: string };

type EditState = { mode: "create" } | { mode: "edit"; row: PlaceRow } | null;

export default function WorkforcePlacesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formOrgUnitId, setFormOrgUnitId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [archiveRow, setArchiveRow] = useState<PlaceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = filterStatus ? `?status=${filterStatus}` : "";
    const [placeRes, unitRes] = await Promise.all([
      wfFetch(`places${qs}`),
      wfFetch("org-units"),
    ]);
    if (await isWorkforceGate403(placeRes)) {
      setNotEntitled(true);
      setRows([]);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (unitRes.ok) {
      const u = await unitRes.json();
      setUnits(
        parseOrgUnitItems<OrgUnit>(u).filter(
          (x) => (x.status ?? "ACTIVE") === "ACTIVE",
        ),
      );
    }
    if (placeRes.ok) {
      setRows(await placeRes.json());
    } else {
      setError(t("loadError"));
    }
    setLoading(false);
  }, [filterStatus, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  function openCreate() {
    setFormCode("");
    setFormName("");
    setFormStatus("ACTIVE");
    setFormOrgUnitId("");
    setFormError(null);
    setEditState({ mode: "create" });
  }

  function openEdit(row: PlaceRow) {
    setFormCode(row.code);
    setFormName(row.name);
    setFormStatus(row.status);
    setFormOrgUnitId(row.responsibleOrgUnitId ?? "");
    setFormError(null);
    setEditState({ mode: "edit", row });
  }

  async function save() {
    if (!formName.trim() || (editState?.mode === "create" && !formCode.trim())) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const body =
      editState?.mode === "create"
        ? {
            code: formCode.trim(),
            name: formName.trim(),
            responsibleOrgUnitId: formOrgUnitId || undefined,
          }
        : {
            name: formName.trim(),
            status: formStatus,
            responsibleOrgUnitId: formOrgUnitId || null,
          };
    const res =
      editState?.mode === "create"
        ? await wfFetch("places", {
            method: "POST",
            body: JSON.stringify(body),
          })
        : await wfFetch(`places/${editState!.row.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
    setBusy(false);
    if (!res.ok) {
      setFormError(t("saveError"));
      return;
    }
    setEditState(null);
    await load();
  }

  async function archivePlace(row: PlaceRow) {
    setBusy(true);
    const res = await wfFetch(`places/${row.id}/archive`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    setArchiveRow(null);
    if (!res.ok) {
      const err = await parseWorkforceApiError(res);
      setError(
        /assignment/i.test(err.message)
          ? t("archivePlaceInUse")
          : err.message?.trim() || t("archivePlaceFailed"),
      );
      return;
    }
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const statusOptions = [
    { value: "ACTIVE", label: t("statusActive") },
    { value: "ARCHIVED", label: t("statusArchived") },
  ];

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("placesTitle")}
          subtitle={t("placesHint")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("addPlace")}
            </button>
          }
        />
      </div>
      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tCommon("filterReset")}
            onReset={() => setFilterStatus("ACTIVE")}
          >
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterStatus")}
              value={filterStatus}
              onChange={(next) =>
                setFilterStatus(Array.isArray(next) ? (next[0] ?? "") : next)
              }
              options={statusOptions}
              emptyLabel={t("statusAll")}
            />
          </EraListFilterBar>
        }
        tableShell={false}
        table={
          <EraDataGrid
            layout="fill"
            columns={[
              { key: "code", header: t("colCode") },
              { key: "name", header: t("colName") },
              {
                key: "orgUnit",
                header: t("responsibleUnit"),
                render: (row) =>
                  units.find((u) => u.id === row.responsibleOrgUnitId)?.name ?? "—",
              },
              {
                key: "status",
                header: t("colStatus"),
                render: (row) =>
                  row.status === "ACTIVE" ? t("statusActive") : t("statusArchived"),
              },
              {
                key: "actions",
                header: "",
                className: "w-20",
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      onClick={() => openEdit(row)}
                      aria-label={tCommon("edit")}
                      title={tCommon("edit")}
                    >
                      <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                    </button>
                    {row.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        onClick={() => setArchiveRow(row)}
                        aria-label={t("archivePlace")}
                        title={t("archivePlace")}
                      >
                        <Archive className="h-4 w-4 text-[#C0392B]" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            emptyMessage={loading ? tCommon("loading") : t("placesEmpty")}
            paginationLabels={{
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
        onClose={() => setEditState(null)}
        title={editState?.mode === "create" ? t("addPlace") : t("editPlace")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setEditState(null)}
            onSubmit={() => void save()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="space-y-3">
          {editState?.mode === "create" ? (
            <CatalogField
              kind="FREE_TEXT"
              label={t("colCode")}
              value={formCode}
              onChange={(v) => setFormCode(String(v))}
              options={[]}
            />
          ) : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={formName}
            onChange={(v) => setFormName(String(v))}
            options={[]}
          />
          {editState?.mode === "edit" ? (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("colStatus")}
              value={formStatus}
              onChange={(v) => setFormStatus(String(v))}
              options={statusOptions}
            />
          ) : null}
          <CatalogField
            kind={unitOptions.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
            label={t("responsibleUnit")}
            value={formOrgUnitId}
            onChange={(v) => setFormOrgUnitId(String(v))}
            options={unitOptions}
            emptyLabel={tCommon("select")}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>
      <WorkforceConfirmDialog
        open={archiveRow !== null}
        title={t("archivePlace")}
        body={t("archivePlaceConfirm", { name: archiveRow?.name ?? "" })}
        confirmLabel={t("archivePlace")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setArchiveRow(null)}
        onConfirm={() => {
          const row = archiveRow;
          if (row) void archivePlace(row);
        }}
      />
    </div>
  );
}
