"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
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
        <p className="mb-4 text-[13px] text-[#2C3E50]">{msg}</p>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} mb-6 overflow-x-auto p-4`}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
              <th className="p-2">{tc("name")}</th>
              <th className="p-2">{t("format")}</th>
              <th className="p-2">{t("delimiter")}</th>
              <th className="p-2 text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-[#7F8C8D]">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-b border-[#ECEFF1]">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2">{p.format}</td>
                  <td className="p-2">{p.delimiter}</td>
                  <td className="p-2 text-right space-x-2">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openEdit(p)}>
                      {tc("edit")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void deleteProfile(p.id)}
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold">{t("importTitle")}</h2>
        <p className="mb-4 text-[13px] text-[#7F8C8D]">{t("importHint")}</p>
        <form onSubmit={(e) => void runImport(e)} className="flex flex-wrap gap-3 items-end text-[13px]">
          <label className="flex flex-col gap-1">
            {t("selectProfile")}
            <select
              className={MODAL_INPUT_CLASS}
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
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t("patientRefId")}
            <input
              className={MODAL_INPUT_CLASS}
              value={importPatientRefId}
              onChange={(e) => setImportPatientRefId(e.target.value)}
              placeholder="cuid…"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            {t("visitIdOptional")}
            <input
              className={MODAL_INPUT_CLASS}
              value={importVisitId}
              onChange={(e) => setImportVisitId(e.target.value)}
            />
          </label>
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
        <div className="space-y-3 text-[13px]">
          <label className="block">
            {tc("name")}
            <input
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block">
            {t("format")}
            <select
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={form.format}
              onChange={(e) =>
                setForm({ ...form, format: e.target.value as LisProfile["format"] })
              }
            >
              <option value="CSV">CSV</option>
              <option value="HL7_FRAGMENT">HL7_FRAGMENT</option>
            </select>
          </label>
          <label className="block">
            {t("delimiter")}
            <input
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={form.delimiter}
              onChange={(e) => setForm({ ...form, delimiter: e.target.value })}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="font-medium">{t("columnMapping")}</legend>
            {MAPPING_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2">
                <span className="w-24 text-[#7F8C8D]">{key}</span>
                <input
                  className={`flex-1 ${MODAL_INPUT_CLASS}`}
                  value={form.columnMapping[key] ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      columnMapping: { ...form.columnMapping, [key]: e.target.value },
                    })
                  }
                />
              </label>
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
