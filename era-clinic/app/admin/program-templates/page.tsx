"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  FIELD_SECTION_CLASS,
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

type BlockKind = "PHYSIO" | "BATH" | "PARAFFIN" | "LAB" | "EXAM" | "CUSTOM";

type ProgramBlock = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  kind: BlockKind | null;
  sortOrder: number;
  memberCodes: string[];
};

type ProgramKnot = { nights: number; procedureCode: string; qty: number };

type ProgramTemplate = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  minNights?: number | null;
  maxNights?: number | null;
  version?: number;
  isCurrent?: boolean;
  retiredAt?: string | null;
  openInstanceCount?: number;
  procedures: ProgramBlock[];
  quotaKnots?: ProgramKnot[];
};

type ProcTypeOpt = { code: string; name: string };

const KNOT_NIGHT_CHIPS = [7, 10, 14, 21];

const KIND_DEFAULT_CODE: Record<BlockKind, string> = {
  PHYSIO: "PHYSIO_POOL",
  BATH: "NAFTALAN_BATH",
  PARAFFIN: "PARAFFIN_POOL",
  LAB: "LAB_BLOCK",
  EXAM: "EXAM_BLOCK",
  CUSTOM: "",
};

function emptyForm() {
  return {
    code: "",
    name: "",
    durationDays: "7",
    minNights: "",
    maxNights: "",
  };
}

function defaultBlockName(kind: BlockKind, t: (k: string) => string): string {
  switch (kind) {
    case "PHYSIO":
      return t("kindPhysio");
    case "BATH":
      return t("kindBath");
    case "PARAFFIN":
      return t("kindParaffin");
    case "LAB":
      return t("kindLab");
    case "EXAM":
      return t("kindExam");
    default:
      return t("kindCustom");
  }
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
  const [editingVersion, setEditingVersion] = useState<number>(1);
  const [openStayCount, setOpenStayCount] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [blocks, setBlocks] = useState<ProgramBlock[]>([]);
  const [knots, setKnots] = useState<ProgramKnot[]>([]);
  const [newBlockKind, setNewBlockKind] = useState<BlockKind>("PHYSIO");
  const [knotNights, setKnotNights] = useState("10");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [includeRetired, setIncludeRetired] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = includeRetired ? "?includeRetired=1" : "";
      const [pRes, ptRes] = await Promise.all([
        fetch(`/api/admin/program-templates${qs}`),
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
  }, [tc, includeRetired]);

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

  const kindOptions = useMemo(
    () =>
      (["PHYSIO", "BATH", "PARAFFIN", "LAB", "EXAM", "CUSTOM"] as BlockKind[]).map((k) => ({
        value: k,
        label: defaultBlockName(k, t),
      })),
    [t],
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
    setEditingVersion(1);
    setOpenStayCount(0);
    setForm(emptyForm());
    setBlocks([]);
    setKnots([]);
    setNewBlockKind("PHYSIO");
    setKnotNights("10");
    setSaveError(null);
    setOpen(true);
  }

  function openEdit(row: ProgramTemplate) {
    setEditingId(row.id);
    setEditingVersion(row.version ?? 1);
    setOpenStayCount(row.openInstanceCount ?? 0);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      minNights: row.minNights != null ? String(row.minNights) : "",
      maxNights: row.maxNights != null ? String(row.maxNights) : "",
    });
    setBlocks(
      (row.procedures ?? []).map((p, i) => ({
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
        kind: (p.kind as BlockKind | null) ?? null,
        sortOrder: p.sortOrder ?? i,
        memberCodes: Array.isArray(p.memberCodes) ? p.memberCodes : [],
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

  function addBlock() {
    const kind = newBlockKind;
    let code = KIND_DEFAULT_CODE[kind];
    if (kind === "CUSTOM") {
      code = `BLOCK_${blocks.length + 1}`;
    }
    if (blocks.some((b) => b.procedureCode === code)) {
      code = `${code}_${blocks.length + 1}`;
    }
    setBlocks([
      ...blocks,
      {
        procedureCode: code,
        procedureName: defaultBlockName(kind, t),
        quotaTotal: 1,
        kind,
        sortOrder: blocks.length,
        memberCodes: [],
      },
    ]);
  }

  function updateBlock(code: string, patch: Partial<ProgramBlock>) {
    if (patch.procedureCode && patch.procedureCode !== code) {
      setKnots((ks) =>
        ks.map((k) =>
          k.procedureCode === code ? { ...k, procedureCode: patch.procedureCode! } : k,
        ),
      );
    }
    setBlocks((prev) => prev.map((b) => (b.procedureCode === code ? { ...b, ...patch } : b)));
  }

  function removeBlock(code: string) {
    setBlocks((prev) => prev.filter((b) => b.procedureCode !== code));
    setKnots((prev) => prev.filter((k) => k.procedureCode !== code));
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
    if (blocks.length === 0) {
      setSaveError(t("addBlockFirst"));
      return;
    }
    const codes = new Set<string>();
    for (const b of blocks) {
      if (!b.procedureCode.trim()) {
        setSaveError(t("validationRequired"));
        return;
      }
      if (codes.has(b.procedureCode)) {
        setSaveError(t("duplicateBlockCode"));
        return;
      }
      codes.add(b.procedureCode);
    }

    setSaving(true);
    try {
      const nights = {
        minNights: form.minNights ? Number(form.minNights) : null,
        maxNights: form.maxNights ? Number(form.maxNights) : null,
      };
      const procedures = blocks.map((b, i) => {
        const knotQtys = knots.filter((k) => k.procedureCode === b.procedureCode).map((k) => k.qty);
        const quotaTotal =
          knotQtys.length > 0 ? Math.max(...knotQtys, 1) : Math.max(1, b.quotaTotal || 1);
        return {
          procedureCode: b.procedureCode.trim(),
          procedureName: b.procedureName.trim() || b.procedureCode,
          quotaTotal,
          kind: b.kind,
          sortOrder: b.sortOrder ?? i,
          memberCodes: b.memberCodes,
        };
      });
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

  async function purgeRetired() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/program-templates?action=purge-retired", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: 0 }),
      });
      if (!res.ok) {
        setLoadError(tc("failed"));
        return;
      }
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
          <div className="flex flex-wrap items-center gap-2">
            <label className={`flex items-center gap-1.5 text-[12px] ${TEXT_MUTED_CLASS}`}>
              <input
                type="checkbox"
                checked={includeRetired}
                onChange={(e) => {
                  setIncludeRetired(e.target.checked);
                  setPage(1);
                }}
              />
              {t("showRetired")}
            </label>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={saving}
              onClick={() => void purgeRetired()}
            >
              {t("purgeRetired")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              {tc("add")}
            </button>
          </div>
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("version")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("durationDays")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("nightsRange")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("blocksCount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("openStays")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {tc("loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      v{row.version ?? 1}
                      {row.isCurrent === false ? (
                        <span className={`ml-1 ${TEXT_MUTED_CLASS}`}>{t("retiredBadge")}</span>
                      ) : null}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.durationDays}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.minNights != null || row.maxNights != null
                        ? `${row.minNights ?? "—"}–${row.maxNights ?? "—"}`
                        : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.procedures?.length ?? 0}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.openInstanceCount ?? 0}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          disabled={row.isCurrent === false}
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
        title={
          editingId
            ? `${tc("edit")} · v${editingVersion}`
            : tc("add")
        }
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-4xl"
      >
        <div className={`${FORM_STACK_CLASS} max-h-[min(70vh,42rem)] overflow-y-auto pr-1`}>
          {editingId ? (
            <p className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950`}>
              {openStayCount > 0
                ? t("versionWarnOpen", { version: editingVersion, count: openStayCount })
                : t("versionWarn", { version: editingVersion })}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {!editingId ? (
              <Field
                label={t("code")}
                preset="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            ) : (
              <p className={`self-end text-[13px] ${TEXT_MUTED_CLASS}`}>
                {t("code")}: <span className="font-medium text-slate-800">{form.code}</span>
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
          </div>

          <section className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800">{t("blocksTitle")}</h3>
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("blocksHint")}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("blockKind")}
                  value={newBlockKind}
                  onChange={(v) => setNewBlockKind(String(v) as BlockKind)}
                  options={kindOptions}
                />
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={addBlock}>
                  <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {t("addBlock")}
                </button>
              </div>
            </div>

            {blocks.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addBlockFirst")}</p>
            ) : (
              <div className="space-y-3">
                {blocks.map((b) => (
                  <div
                    key={b.procedureCode}
                    className="space-y-2 rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <Field
                          label={t("blockCode")}
                          preset="code"
                          value={b.procedureCode}
                          onChange={(e) =>
                            updateBlock(b.procedureCode, { procedureCode: e.target.value })
                          }
                        />
                        <Field
                          label={t("blockName")}
                          preset="shortText"
                          value={b.procedureName}
                          onChange={(e) =>
                            updateBlock(b.procedureCode, { procedureName: e.target.value })
                          }
                        />
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t("blockKind")}
                          value={b.kind ?? "CUSTOM"}
                          onChange={(v) =>
                            updateBlock(b.procedureCode, { kind: String(v) as BlockKind })
                          }
                          options={kindOptions}
                        />
                      </div>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => removeBlock(b.procedureCode)}
                      >
                        {tc("delete")}
                      </button>
                    </div>
                    <CatalogField
                      kind="MULTI"
                      label={t("blockMembers")}
                      value={b.memberCodes}
                      onChange={(next) =>
                        updateBlock(b.procedureCode, {
                          memberCodes: Array.isArray(next)
                            ? next.map(String)
                            : next
                              ? [String(next)]
                              : [],
                        })
                      }
                      options={procOptions}
                    />
                    <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>
                      {b.memberCodes.length === 0
                        ? t("membersEmptyHint")
                        : t("membersCount", { count: b.memberCodes.length })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
            <div>
              <h3 className="text-[13px] font-semibold text-slate-800">{t("knotsMatrix")}</h3>
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("knotsHint")}</p>
            </div>
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
            {blocks.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addBlockFirst")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-1 text-left">{t("blockName")}</th>
                      {nightCols.map((n) => (
                        <th key={n} className="p-1 text-center">
                          {n}n
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => (
                      <tr key={b.procedureCode}>
                        <td className="p-1">
                          <span className="font-medium">{b.procedureName}</span>
                          <span className={`ml-1 ${TEXT_MUTED_CLASS}`}>({b.procedureCode})</span>
                        </td>
                        {nightCols.map((n) => (
                          <td key={n} className="p-1 text-center">
                            <input
                              type="number"
                              min={0}
                              className="w-14 border px-1 py-0.5 text-center"
                              value={knotQty(n, b.procedureCode) || ""}
                              onChange={(e) =>
                                setKnotQty(n, b.procedureCode, Number(e.target.value) || 0)
                              }
                              aria-label={`${b.procedureCode} ${n}n`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
