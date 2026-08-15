"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldTextarea,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type ClinicalTemplate = {
  id: string;
  code: string;
  title: string;
  specialty?: string | null;
  bodyJson?: string;
};
type ProgramTemplate = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  procedures: Array<{ procedureCode: string; procedureName: string; quotaTotal: number }>;
};

export default function TemplatesAdminPage() {
  const t = useTranslations("templatesAdmin");
  const tc = useTranslations("common");
  const [clinical, setClinical] = useState<ClinicalTemplate[]>([]);
  const [programs, setPrograms] = useState<ProgramTemplate[]>([]);
  const [tab, setTab] = useState<"clinical" | "program">("clinical");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      fetch("/api/admin/clinical-templates").then((r) => r.json()),
      fetch("/api/admin/program-templates").then((r) => r.json()),
    ]);
    setClinical((c.data ?? c) as ClinicalTemplate[]);
    setPrograms((p.data ?? p) as ProgramTemplate[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({});
    setOpen(true);
  }

  function openEditClinical(row: ClinicalTemplate) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      title: row.title,
      specialty: row.specialty ?? "",
      bodyJson: row.bodyJson ?? "{}",
    });
    setOpen(true);
  }

  function openEditProgram(row: ProgramTemplate) {
    const proc = row.procedures[0];
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      procedureCode: proc?.procedureCode ?? "",
      procedureName: proc?.procedureName ?? "",
      quotaTotal: String(proc?.quotaTotal ?? 1),
    });
    setOpen(true);
  }

  async function save() {
    if (tab === "clinical") {
      const payload = editingId
        ? {
            title: form.title,
            specialty: form.specialty || null,
            bodyJson: form.bodyJson ?? "{}",
          }
        : {
            code: form.code,
            title: form.title,
            specialty: form.specialty,
            bodyJson: form.bodyJson ?? "{}",
          };
      const url = editingId
        ? `/api/admin/clinical-templates/${editingId}`
        : "/api/admin/clinical-templates";
      await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const procedures = form.procedureCode
        ? [
            {
              procedureCode: form.procedureCode,
              procedureName: form.procedureName ?? form.procedureCode,
              quotaTotal: Number(form.quotaTotal ?? "1"),
            },
          ]
        : [];
      const payload = editingId
        ? {
            name: form.name,
            durationDays: Number(form.durationDays ?? "7"),
            procedures,
          }
        : {
            code: form.code,
            name: form.name,
            durationDays: Number(form.durationDays ?? "7"),
            procedures,
          };
      const url = editingId
        ? `/api/admin/program-templates/${editingId}`
        : "/api/admin/program-templates";
      await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    if (tab === "clinical") {
      await fetch(`/api/admin/clinical-templates?id=${deleteId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/admin/program-templates?id=${deleteId}`, { method: "DELETE" });
    }
    setDeleteId(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {tc("add")}
          </button>
        }
      />
      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === "clinical" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("clinical")}>
          {t("clinicalTab")}
        </button>
        <button type="button" className={tab === "program" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("program")}>
          {t("programTab")}
        </button>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        {tab === "clinical" &&
          clinical.map((row) => (
            <div key={row.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {row.title} · {row.code}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("edit")}
                  onClick={() => openEditClinical(row)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("delete")}
                  onClick={() => setDeleteId(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </div>
          ))}
        {tab === "program" &&
          programs.map((row) => (
            <div key={row.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {row.name} · {row.code} ({row.durationDays}d, {row.procedures.length} proc)
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("edit")}
                  onClick={() => openEditProgram(row)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("delete")}
                  onClick={() => setDeleteId(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </div>
          ))}
      </div>
      <ModalShell open={open} title={editingId ? tc("edit") : tc("add")} onClose={() => setOpen(false)}>
        <div className={FORM_STACK_CLASS}>
          {!editingId ? (
            <Field
              label={t("code")}
              preset="code"
              value={form.code ?? ""}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          ) : null}
          {tab === "clinical" ? (
            <>
              <Field
                label={t("titleField")}
                preset="shortText"
                value={form.title ?? ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Field
                label={t("specialty")}
                preset="shortText"
                value={form.specialty ?? ""}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              />
              <FieldTextarea
                label={t("bodyJson")}
                rows={4}
                value={form.bodyJson ?? "{}"}
                onChange={(e) => setForm({ ...form, bodyJson: e.target.value })}
              />            </>
          ) : (
            <>
              <Field
                label={t("name")}
                preset="shortText"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Field
                label={t("durationDays")}
                preset="count"
                value={form.durationDays ?? "7"}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              />
              <Field
                label={t("procedureCode")}
                preset="code"
                value={form.procedureCode ?? ""}
                onChange={(e) => setForm({ ...form, procedureCode: e.target.value })}
              />
              <Field
                label={t("procedureName")}
                preset="shortText"
                value={form.procedureName ?? ""}
                onChange={(e) => setForm({ ...form, procedureName: e.target.value })}
              />
              <Field
                label={t("quotaTotal")}
                preset="count"
                value={form.quotaTotal ?? "1"}
                onChange={(e) => setForm({ ...form, quotaTotal: e.target.value })}
              />
            </>
          )}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>

      <ModalShell open={!!deleteId} title={tc("confirmDelete")} onClose={() => setDeleteId(null)}>
        <ModalFooter onCancel={() => setDeleteId(null)} onSubmit={() => void confirmDelete()} submitLabel={tc("delete")} />
      </ModalShell>
    </>
  );
}
