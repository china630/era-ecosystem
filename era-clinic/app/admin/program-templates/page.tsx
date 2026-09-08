"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FORM_STACK_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

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

function emptyForm() {
  return {
    code: "",
    name: "",
    durationDays: "7",
    minNights: "",
    maxNights: "",
  };
}

export default function ProgramTemplatesAdminPage() {
  const t = useTranslations("programTemplatesAdmin");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<ProgramTemplate[]>([]);
  const [procTypes, setProcTypes] = useState<ProcTypeOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [procedures, setProcedures] = useState<ProgramProcedure[]>([]);
  const [knots, setKnots] = useState<ProgramKnot[]>([]);
  const [addProcCode, setAddProcCode] = useState("");
  const [knotNights, setKnotNights] = useState("10");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pRes, ptRes] = await Promise.all([
        fetch("/api/admin/program-templates"),
        fetch("/api/procedure-types"),
      ]);
      if (!pRes.ok) {
        setRows([]);
        setLoadError(tc("failed"));
        return;
      }
      const pJson = await pRes.json();
      const list = (pJson.data ?? pJson) as ProgramTemplate[];
      setRows(Array.isArray(list) ? list : []);

      if (ptRes.ok) {
        const ptJson = await ptRes.json();
        const ptList = (ptJson.data ?? ptJson) as Array<{ code: string; name?: string }>;
        setProcTypes(
          (Array.isArray(ptList) ? ptList : []).map((x) => ({
            code: x.code,
            name: x.name ?? x.code,
          })),
        );
      }
    } catch {
      setRows([]);
      setLoadError(tc("failed"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const procOptions = useMemo(
    () => procTypes.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` })),
    [procTypes],
  );

  const nightCols = useMemo(() => {
    const fromKnots = [...new Set(knots.map((k) => k.nights))];
    const n = Number(knotNights);
    if (n > 0 && !fromKnots.includes(n)) fromKnots.push(n);
    for (const c of KNOT_NIGHT_CHIPS) {
      if (!fromKnots.includes(c)) fromKnots.push(c);
    }
    return fromKnots.sort((a, b) => a - b);
  }, [knots, knotNights]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setProcedures([]);
    setKnots([]);
    setAddProcCode("");
    setKnotNights("10");
    setSaveError(null);
    setOpen(true);
  }

  function openEdit(row: ProgramTemplate) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      minNights: row.minNights != null ? String(row.minNights) : "",
      maxNights: row.maxNights != null ? String(row.maxNights) : "",
    });
    setProcedures(
      (row.procedures ?? []).map((p) => ({
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
    setSaveError(null);
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
    setSaveError(null);
    const name = form.name.trim();
    const code = form.code.trim();
    const durationDays = Number(form.durationDays);
    if (!name || (!editingId && !code) || !Number.isFinite(durationDays) || durationDays < 1) {
      setSaveError(t("validationRequired"));
      return;
    }
    if (procedures.length === 0) {
      setSaveError(t("addProcedureFirst"));
      return;
    }

    setSaving(true);
    try {
      const nights = {
        minNights: form.minNights ? Number(form.minNights) : null,
        maxNights: form.maxNights ? Number(form.maxNights) : null,
      };
      const payload = editingId
        ? {
            name,
            durationDays,
            ...nights,
            procedures,
            knots,
          }
        : {
            code,
            name,
            durationDays,
            ...nights,
            procedures,
            knots,
          };
      const url = editingId
        ? `/api/admin/program-templates/${editingId}`
        : "/api/admin/program-templates";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaveError(tc("saveFailed"));
        return;
      }
      setOpen(false);
      setPage(1);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/program-templates?id=${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } finally {
      setSaving(false);
    }
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

      {loadError ? <p className={`mb-3 text-[13px] ${TEXT_MUTED_CLASS}`}>{loadError}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("durationDays")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("nightsRange")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("proceduresCount")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {tc("loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.durationDays}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.minNights != null || row.maxNights != null
                        ? `${row.minNights ?? "—"}–${row.maxNights ?? "—"}`
                        : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.procedures?.length ?? 0}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openEdit(row)}
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
          total={rows.length}
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

      <ModalShell
        open={open}
        title={editingId ? tc("edit") : tc("add")}
        onClose={() => setOpen(false)}
      >
        <div className={FORM_STACK_CLASS}>
          {!editingId ? (
            <Field
              label={t("code")}
              preset="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          ) : (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
              {t("code")}: <span className="font-medium">{form.code}</span>
            </p>
          )}
          <Field
            label={t("name")}
            preset="shortText"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label={t("durationDays")}
            preset="count"
            value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
          />
          <Field
            label={t("minNights")}
            preset="count"
            value={form.minNights}
            onChange={(e) => setForm({ ...form, minNights: e.target.value })}
          />
          <Field
            label={t("maxNights")}
            preset="count"
            value={form.maxNights}
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
                  className={Number(knotNights) === n ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
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

          {saveError ? <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{saveError}</p> : null}
        </div>
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => void save()}
          submitLabel={tc("save")}
          submitDisabled={saving}
        />
      </ModalShell>

      <ModalShell open={!!deleteId} title={tc("confirmDelete")} onClose={() => setDeleteId(null)}>
        <p className={`mb-3 text-[13px] ${TEXT_MUTED_CLASS}`}>{t("confirmDeleteBody")}</p>
        <ModalFooter
          onCancel={() => setDeleteId(null)}
          onSubmit={() => void confirmDelete()}
          submitLabel={tc("delete")}
          submitDisabled={saving}
        />
      </ModalShell>
    </>
  );
}
