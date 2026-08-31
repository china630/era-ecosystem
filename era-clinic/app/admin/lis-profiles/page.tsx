"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type LisProfile = {
  id: string;
  name: string;
  format: "CSV" | "HL7_FRAGMENT";
  delimiter: string;
  columnMapping: string;
};

const MAPPING_KEYS = ["testCode", "analyte", "value", "refMin", "refMax"] as const;

function parseMapping(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function emptyForm(): {
  name: string;
  format: LisProfile["format"];
  delimiter: string;
  columnMapping: Record<string, string>;
} {
  return {
    name: "",
    format: "CSV",
    delimiter: ",",
    columnMapping: Object.fromEntries(MAPPING_KEYS.map((k) => [k, k])),
  };
}

export default function LisProfilesAdminPage() {
  const t = useTranslations("lisProfiles");
  const tc = useTranslations("common");
  const [profiles, setProfiles] = useState<LisProfile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importProfileId, setImportProfileId] = useState("");
  const [importPatientRefId, setImportPatientRefId] = useState("");
  const [importVisitId, setImportVisitId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedProfiles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return profiles.slice(start, start + pageSize);
  }, [profiles, page, pageSize]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lis-profiles");
    if (res.ok) {
      const data = await res.json();
      const rows = (data.data ?? data) as LisProfile[];
      setProfiles(Array.isArray(rows) ? rows : []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(profile: LisProfile) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      format: profile.format,
      delimiter: profile.delimiter,
      columnMapping: { ...emptyForm().columnMapping, ...parseMapping(profile.columnMapping) },
    });
    setModalOpen(true);
  }

  async function saveProfile() {
    setMsg(null);
    const payload = {
      name: form.name.trim(),
      format: form.format,
      delimiter: form.delimiter,
      columnMapping: form.columnMapping,
    };
    const res = await fetch(
      editingId ? `/api/admin/lis-profiles/${editingId}` : "/api/admin/lis-profiles",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      setMsg(tc("saveFailed"));
      return;
    }
    setModalOpen(false);
    setMsg(editingId ? t("updated") : t("created"));
    await load();
  }

  async function deleteProfile(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/admin/lis-profiles/${id}`, { method: "DELETE" });
    setMsg(res.ok ? t("deleted") : tc("failed"));
    await load();
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importProfileId || !importPatientRefId || !importFile) {
      setMsg(t("importMissingFields"));
      return;
    }
    setImportBusy(true);
    setMsg(null);
    try {
      const csvText = await importFile.text();
      const res = await fetch("/api/lab-orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: importProfileId,
          patientRefId: importPatientRefId,
          visitId: importVisitId.trim() || undefined,
          csvText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? tc("failed"));
        return;
      }
      const count = json.data?.imported ?? json.imported ?? 0;
      setMsg(t("importSuccess", { count }));
      setImportFile(null);
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {t("addProfile")}
          </button>
        }
      />

      {msg ? (
        <p className="mb-4 text-[13px]">{msg}</p>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} mb-6 space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("name")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("format")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("delimiter")}</th>
              <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                  {t("empty")}
                </td>
              </tr>
            ) : (
              pagedProfiles.map((p) => (
                <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{p.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.format}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.delimiter}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={tc("edit")}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={t("delete")}
                        onClick={() => void deleteProfile(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={profiles.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>

      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold">{t("importTitle")}</h2>
        <p className={`mb-4 text-[13px] ${TEXT_MUTED_CLASS}`}>{t("importHint")}</p>
        <form onSubmit={(e) => void runImport(e)} className="flex flex-wrap items-end gap-3 text-[13px]">
          <FieldSelect
            label={t("selectProfile")}
            preset="select"
            value={importProfileId}
            onChange={(e) => setImportProfileId(e.target.value)}
            required
          >
            <option value="">{tc("select")}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </FieldSelect>
          <Field
            label={t("patientRefId")}
            preset="code"
            value={importPatientRefId}
            onChange={(e) => setImportPatientRefId(e.target.value)}
            placeholder="cuid…"
            required
          />
          <Field
            label={t("visitIdOptional")}
            preset="code"
            value={importVisitId}
            onChange={(e) => setImportVisitId(e.target.value)}
          />
          <label className="flex flex-col gap-1">
            {t("csvFile")}
            <input
              type="file"
              accept=".csv,text/csv"
              className="text-[13px]"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={importBusy}>
            {importBusy ? tc("loading") : t("runImport")}
          </button>
        </form>
      </div>

      <ModalShell
        open={modalOpen}
        title={editingId ? t("editProfile") : t("addProfile")}
        onClose={() => setModalOpen(false)}
      >
        <div className={FORM_STACK_CLASS}>
          <Field
            label={tc("name")}
            preset="shortText"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <FieldSelect
            label={t("format")}
            preset="select"
            value={form.format}
            onChange={(e) =>
              setForm({ ...form, format: e.target.value as LisProfile["format"] })
            }
          >
            <option value="CSV">CSV</option>
            <option value="HL7_FRAGMENT">HL7_FRAGMENT</option>
          </FieldSelect>
          <Field
            label={t("delimiter")}
            preset="code"
            value={form.delimiter}
            onChange={(e) => setForm({ ...form, delimiter: e.target.value })}
          />
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold">{t("columnMapping")}</legend>
            {MAPPING_KEYS.map((key) => (
              <Field
                key={key}
                label={key}
                preset="shortText"
                value={form.columnMapping[key] ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    columnMapping: { ...form.columnMapping, [key]: e.target.value },
                  })
                }
              />
            ))}
          </fieldset>
        </div>
        <ModalFooter
          onCancel={() => setModalOpen(false)}
          onSubmit={() => void saveProfile()}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </>
  );
}
