"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
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
type ProgramProcedure = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
};
type ProgramKnot = { nights: number; procedureCode: string; qty: number };
type ProgramTemplate = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  minNights?: number | null;
  maxNights?: number | null;
  procedures: ProgramProcedure[];
  quotaKnots?: ProgramKnot[];
};
type ProcTypeOpt = { code: string; name: string };

const KNOT_NIGHT_CHIPS = [7, 10, 14, 21];

export default function TemplatesAdminPage() {
  const t = useTranslations("templatesAdmin");
  const tc = useTranslations("common");
  const [clinical, setClinical] = useState<ClinicalTemplate[]>([]);
  const [programs, setPrograms] = useState<ProgramTemplate[]>([]);
  const [procTypes, setProcTypes] = useState<ProcTypeOpt[]>([]);
  const [tab, setTab] = useState<"clinical" | "program">("clinical");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [procedures, setProcedures] = useState<ProgramProcedure[]>([]);
  const [knots, setKnots] = useState<ProgramKnot[]>([]);
  const [addProcCode, setAddProcCode] = useState("");
  const [knotNights, setKnotNights] = useState("10");

  const load = useCallback(async () => {
    const [c, p, pt] = await Promise.all([
      fetch("/api/admin/clinical-templates").then((r) => r.json()),
      fetch("/api/admin/program-templates").then((r) => r.json()),
      fetch("/api/procedure-types").then((r) => r.json()),
    ]);
    setClinical((c.data ?? c) as ClinicalTemplate[]);
    setPrograms((p.data ?? p) as ProgramTemplate[]);
    const list = (pt.data ?? pt) as Array<{ code: string; name?: string }>;
    setProcTypes(
      (Array.isArray(list) ? list : []).map((x) => ({
        code: x.code,
        name: x.name ?? x.code,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const procOptions = useMemo(
    () => procTypes.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` })),
    [procTypes],
  );

  function openCreate() {
    setEditingId(null);
    setForm({});
    setProcedures([]);
    setKnots([]);
    setAddProcCode("");
    setKnotNights("10");
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
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      minNights: row.minNights != null ? String(row.minNights) : "",
      maxNights: row.maxNights != null ? String(row.maxNights) : "",
    });
    setProcedures(
      row.procedures.map((p) => ({
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
      })),
    );
    setKnots(
      (row.quotaKnots ?? []).map((k) => ({
        nights: k.nights,
        procedureCode: k.procedureCode,
        qty: k.qty,
      })),
    );
    setOpen(true);
  }

  function addProcedure() {
    if (!addProcCode) return;
    if (procedures.some((p) => p.procedureCode === addProcCode)) return;
    const meta = procTypes.find((p) => p.code === addProcCode);
    setProcedures([
      ...procedures,
      {
        procedureCode: addProcCode,
        procedureName: meta?.name ?? addProcCode,
        quotaTotal: 1,
      },
    ]);
    setAddProcCode("");
  }

  function setKnotQty(nights: number, procedureCode: string, qty: number) {
    const next = knots.filter(
      (k) => !(k.nights === nights && k.procedureCode === procedureCode),
    );
    if (qty > 0) next.push({ nights, procedureCode, qty });
    setKnots(next);
  }

  function knotQty(nights: number, procedureCode: string): number {
    return knots.find((k) => k.nights === nights && k.procedureCode === procedureCode)?.qty ?? 0;
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
      const payload = editingId
        ? {
            name: form.name,
            durationDays: Number(form.durationDays ?? "7"),
            minNights: form.minNights ? Number(form.minNights) : null,
            maxNights: form.maxNights ? Number(form.maxNights) : null,
            procedures,
            knots,
          }
        : {
            code: form.code,
            name: form.name,
            durationDays: Number(form.durationDays ?? "7"),
            procedures,
            knots,
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

  const nightCols = useMemo(() => {
    const fromKnots = [...new Set(knots.map((k) => k.nights))];
    const n = Number(knotNights);
    if (n > 0 && !fromKnots.includes(n)) fromKnots.push(n);
    for (const c of KNOT_NIGHT_CHIPS) {
      if (!fromKnots.includes(c)) fromKnots.push(c);
    }
    return fromKnots.sort((a, b) => a - b);
  }, [knots, knotNights]);

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
        <button
          type="button"
          className={tab === "clinical" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
          onClick={() => setTab("clinical")}
        >
          {t("clinicalTab")}
        </button>
        <button
          type="button"
          className={tab === "program" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
          onClick={() => setTab("program")}
        >
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
              />
            </>
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
                label={t("minNights")}
                preset="count"
                value={form.minNights ?? ""}
                onChange={(e) => setForm({ ...form, minNights: e.target.value })}
              />
              <Field
                label={t("maxNights")}
                preset="count"
                value={form.maxNights ?? ""}
                onChange={(e) => setForm({ ...form, maxNights: e.target.value })}
              />

              <div className="space-y-2">
                <p className={`text-[12px] font-medium ${TEXT_MUTED_CLASS}`}>{t("proceduresMatrix")}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <CatalogField
                    kind="SEARCHABLE"
                    label={t("procedureCode")}
                    value={addProcCode}
                    onChange={(v) => setAddProcCode(String(v))}
                    options={procOptions}
                    emptyLabel="—"
                  />
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={addProcedure}>
                    {t("addProcedure")}
                  </button>
                </div>
                {procedures.map((p) => (
                  <div key={p.procedureCode} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="min-w-[10rem]">
                      {p.procedureCode} · {p.procedureName}
                    </span>
                    <Field
                      label={t("quotaTotal")}
                      preset="count"
                      value={String(p.quotaTotal)}
                      onChange={(e) => {
                        const q = Number(e.target.value) || 0;
                        setProcedures(
                          procedures.map((x) =>
                            x.procedureCode === p.procedureCode ? { ...x, quotaTotal: q } : x,
                          ),
                        );
                      }}
                    />
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() =>
                        setProcedures(procedures.filter((x) => x.procedureCode !== p.procedureCode))
                      }
                    >
                      {tc("delete")}
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className={`text-[12px] font-medium ${TEXT_MUTED_CLASS}`}>{t("knotsMatrix")}</p>
                <div className="flex flex-wrap gap-2">
                  {KNOT_NIGHT_CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={
                        Number(knotNights) === n ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS
                      }
                      onClick={() => setKnotNights(String(n))}
                    >
                      {n}n
                    </button>
                  ))}
                  <Field
                    label={t("customNights")}
                    preset="count"
                    value={knotNights}
                    onChange={(e) => setKnotNights(e.target.value)}
                  />
                </div>
                {procedures.length === 0 ? (
                  <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addProcedureFirst")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr>
                          <th className="p-1 text-left">{t("procedureCode")}</th>
                          {nightCols.map((n) => (
                            <th key={n} className="p-1 text-center">
                              {n}n
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {procedures.map((p) => (
                          <tr key={p.procedureCode}>
                            <td className="p-1">{p.procedureCode}</td>
                            {nightCols.map((n) => (
                              <td key={n} className="p-1 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-14 border px-1 py-0.5 text-center"
                                  value={knotQty(n, p.procedureCode) || ""}
                                  onChange={(e) =>
                                    setKnotQty(n, p.procedureCode, Number(e.target.value) || 0)
                                  }
                                  aria-label={`${p.procedureCode} ${n}n`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>

      <ModalShell open={!!deleteId} title={tc("confirmDelete")} onClose={() => setDeleteId(null)}>
        <ModalFooter
          onCancel={() => setDeleteId(null)}
          onSubmit={() => void confirmDelete()}
          submitLabel={tc("delete")}
        />
      </ModalShell>
    </>
  );
}
