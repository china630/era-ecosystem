"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
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
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

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

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const statusOptions = [
    { value: "ACTIVE", label: t("statusActive") },
    { value: "ARCHIVED", label: t("statusArchived") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("placesTitle")}
        subtitle={t("placesHint")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("addPlace")}
          </button>
        }
      />
      <EraListFilterBar
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
        />
      </EraListFilterBar>
      <div className={CARD_CONTAINER_CLASS}>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.status === "ACTIVE" ? t("statusActive") : t("statusArchived")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        onClick={() => openEdit(row)}
                        aria-label={tCommon("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
            kind="ENTITY_REF"
            label={t("responsibleUnit")}
            value={formOrgUnitId}
            onChange={(v) => setFormOrgUnitId(String(v))}
            options={unitOptions}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
