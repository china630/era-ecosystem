"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
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
import { pickL10n, type DiagnosticCatalogItem } from "@/domain/catalog/diagnostic-catalog-shared";
import {
  CUSTOM_QUERY_MIN,
  filterCustomSkus,
  filterTreatmentSkus,
  fulfillmentFromKind,
  type ProgramBlockFulfillment,
  type ProgramBlockKind,
} from "@/domain/sanatorium/program-block-catalog";

type BlockKind = ProgramBlockKind;
type AssignMode = "AUTO_ON_OPEN" | "AUTO_DAY1" | "ON_INDICATION" | "MANUAL";
type QuotaBasis = "PER_NIGHTS" | "PER_STAY";

type ProgramBlock = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  kind: BlockKind | null;
  sortOrder: number;
  memberCodes: string[];
  assignMode: AssignMode | "";
  fulfillment: ProgramBlockFulfillment | "";
  quotaBasis: QuotaBasis | "";
  requiresDoctor: boolean | null;
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
  /** Sales window (`YYYY-MM-DD`); `effectiveTo` null = open-ended. */
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  retiredAt?: string | null;
  openInstanceCount?: number;
  pinInstanceCount?: number;
  procedures: ProgramBlock[];
  quotaKnots?: ProgramKnot[];
};

type ProcTypeOpt = { code: string; name: string };

const KNOT_NIGHT_CHIPS = [7, 10, 14, 21];

/** Known pool / alias entitlement codes — membership chips are optional. */
function isEntitlementPoolOrAlias(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (!c) return false;
  if (c.endsWith("_POOL") || c.endsWith("_BLOCK")) return true;
  if (c === "NAFTALAN_BATH" || c === "NAFTALAN") return true;
  return false;
}

function inferBlockKind(code: string, kind: BlockKind | null | undefined): BlockKind {
  if (kind) return kind;
  const c = code.trim().toUpperCase();
  if (c === "PHYSIO_POOL" || c.startsWith("PHYSIO_POOL_")) return "PHYSIO";
  if (c === "PARAFFIN_POOL" || c.startsWith("PARAFFIN_POOL_")) return "PARAFFIN";
  if (c === "NAFTALAN_BATH" || c === "NAFTALAN" || c.includes("NAFTALAN")) return "BATH";
  if (c === "LAB_BLOCK" || c.startsWith("LAB_") || c.startsWith("LAB-") || c === "LAB") return "LAB";
  if (
    c === "EXAM_BLOCK" ||
    c === "THERAPIST" ||
    c === "GYN" ||
    c === "ECG" ||
    c === "USG" ||
    c === "NEURO"
  ) {
    return "EXAM";
  }
  if (["ALT", "AST", "GLU", "CBC", "UREA", "CREA"].includes(c)) return "LAB";
  return "CUSTOM";
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

function emptyBlockDraft(existing: ProgramBlock[]): ProgramBlock {
  return {
    procedureCode: "",
    procedureName: "",
    quotaTotal: 1,
    kind: null,
    sortOrder: existing.length,
    memberCodes: [],
    assignMode: "",
    fulfillment: "",
    quotaBasis: "",
    requiresDoctor: null,
  };
}

/** Codes shown as chips under a block row (members, else self for single-SKU lines). */
function displayMemberCodes(b: ProgramBlock): string[] {
  if (b.memberCodes.length > 0) return b.memberCodes;
  if (isEntitlementPoolOrAlias(b.procedureCode)) return [];
  return b.procedureCode.trim() ? [b.procedureCode] : [];
}

function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** API sends `@db.Date` as an ISO instant — the picker works on the calendar part. */
function toYmd(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function formatYmd(value?: string | null): string {
  const ymd = toYmd(value);
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

/** Past `effectiveTo` — row is history even when the version is still flagged current. */
function isExpired(row: ProgramTemplate): boolean {
  const to = toYmd(row.effectiveTo);
  return Boolean(to) && to < todayYmd();
}

function emptyForm() {
  return {
    code: "",
    name: "",
    durationDays: "7",
    minNights: "",
    maxNights: "",
    effectiveFrom: todayYmd(),
    effectiveTo: "",
  };
}

export default function ProgramTemplatesAdminPage() {
  const t = useTranslations("programTemplatesAdmin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rows, setRows] = useState<ProgramTemplate[]>([]);
  const [procTypes, setProcTypes] = useState<ProcTypeOpt[]>([]);
  const [diagItems, setDiagItems] = useState<DiagnosticCatalogItem[]>([]);
  const [labCategory, setLabCategory] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number>(1);
  const [openStayCount, setOpenStayCount] = useState(0);
  const [pinStayCount, setPinStayCount] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [blocks, setBlocks] = useState<ProgramBlock[]>([]);
  const [knots, setKnots] = useState<ProgramKnot[]>([]);
  const [knotNights, setKnotNights] = useState("10");
  /** Explicit night columns in the matrix (chips add; × on header removes). */
  const [matrixNights, setMatrixNights] = useState<number[]>([...KNOT_NIGHT_CHIPS]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [includeRetired, setIncludeRetired] = useState(false);
  /** Nested block editor — commits into local `blocks` only until package Save. */
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockOriginalCode, setBlockOriginalCode] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<ProgramBlock | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [memberPick, setMemberPick] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = includeRetired ? "?includeRetired=1" : "";
      const [pRes, ptRes, diagRes] = await Promise.all([
        fetch(`/api/admin/program-templates${qs}`),
        fetch(`/api/admin/procedure-types?locale=${encodeURIComponent(locale)}`),
        fetch("/api/diagnostic-catalog?kinds=lab_panel,visit&applyFavorites=false"),
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
        const seen = new Set<string>();
        const unique: ProcTypeOpt[] = [];
        for (const x of Array.isArray(ptList) ? ptList : []) {
          const code = String(x.code ?? "").trim();
          if (!code) continue;
          const key = code.normalize("NFC").toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push({ code, name: x.name ?? code });
        }
        unique.sort((a, b) => a.code.localeCompare(b.code));
        setProcTypes(unique);
      }
      if (diagRes.ok) {
        const diagJson = await diagRes.json();
        const payload = (diagJson.data ?? diagJson) as { items?: DiagnosticCatalogItem[] };
        setDiagItems(Array.isArray(payload.items) ? payload.items : []);
      }
    } catch {
      setRows([]);
      setLoadError(tc("failed"));
    } finally {
      setLoading(false);
    }
  }, [tc, includeRetired, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteTarget = useMemo(
    () => rows.find((r) => r.id === deleteId) ?? null,
    [rows, deleteId],
  );

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const diagSkuOptions = useMemo(
    () =>
      diagItems.map((item) => ({
        value: item.code,
        label: `${item.code} · ${pickL10n(item.title, locale)}`,
        kind: item.kind,
        category: item.category,
      })),
    [diagItems, locale],
  );

  const labCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const item of diagItems) {
      if (item.kind !== "lab_panel") continue;
      const cat = String(item.category ?? "").trim();
      if (!cat || seen.has(cat)) continue;
      seen.add(cat);
      opts.push({ value: cat, label: cat });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [diagItems]);

  const memberPickOptions = useMemo(() => {
    const taken = new Set(blockDraft?.memberCodes ?? []);
    const kind = blockDraft?.kind;
    if (!kind) return [];

    let source: { value: string; label: string }[] = [];
    if (kind === "PHYSIO" || kind === "BATH" || kind === "PARAFFIN") {
      source = filterTreatmentSkus(kind, procTypes).map((p) => ({
        value: p.code,
        label: `${p.code} · ${p.name}`,
      }));
    } else if (kind === "LAB") {
      source = diagSkuOptions.filter((o) => {
        if (o.kind !== "lab_panel") return false;
        if (labCategory && o.category !== labCategory) return false;
        return true;
      });
    } else if (kind === "EXAM") {
      source = diagSkuOptions.filter((o) => o.kind === "visit");
    } else {
      const merged: { code: string; name: string }[] = [
        ...procTypes,
        ...diagItems.map((item) => ({
          code: item.code,
          name: pickL10n(item.title, locale),
        })),
      ];
      source = filterCustomSkus(memberQuery, merged).map((p) => ({
        value: p.code,
        label: `${p.code} · ${p.name}`,
      }));
    }
    return source.filter((o) => !taken.has(o.value));
  }, [
    blockDraft?.kind,
    blockDraft?.memberCodes,
    procTypes,
    diagSkuOptions,
    diagItems,
    labCategory,
    memberQuery,
    locale,
  ]);

  const kindOptions = useMemo(
    () =>
      (["PHYSIO", "BATH", "PARAFFIN", "LAB", "EXAM", "CUSTOM"] as BlockKind[]).map((k) => ({
        value: k,
        label: defaultBlockName(k, t),
      })),
    [t],
  );

  const assignModeOptions = useMemo(
    () =>
      (
        [
          "AUTO_ON_OPEN",
          "AUTO_DAY1",
          "ON_INDICATION",
          "MANUAL",
        ] as AssignMode[]
      ).map((v) => ({ value: v, label: t(`assignMode_${v}`) })),
    [t],
  );

  const quotaBasisOptions = useMemo(
    () =>
      (["PER_NIGHTS", "PER_STAY"] as QuotaBasis[]).map((v) => ({
        value: v,
        label: t(`quotaBasis_${v}`),
      })),
    [t],
  );

  const nightCols = useMemo(
    () => [...new Set(matrixNights.filter((n) => n > 0))].sort((a, b) => a - b),
    [matrixNights],
  );

  const matrixBlocks = useMemo(() => {
    const kindRank = (k: BlockKind | null) => {
      if (k === "EXAM" || k === "LAB") return 0;
      return 1;
    };
    return [...blocks].sort((a, b) => {
      const ka = inferBlockKind(a.procedureCode, a.kind);
      const kb = inferBlockKind(b.procedureCode, b.kind);
      const r = kindRank(ka) - kindRank(kb);
      if (r !== 0) return r;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [blocks]);

  function openCreate() {
    setEditingId(null);
    setEditingVersion(1);
    setOpenStayCount(0);
    setPinStayCount(0);
    setForm(emptyForm());
    setBlocks([]);
    setKnots([]);
    setKnotNights("10");
    setMatrixNights([...KNOT_NIGHT_CHIPS]);
    setSaveError(null);
    closeBlockModal();
    setOpen(true);
  }

  function openEdit(row: ProgramTemplate) {
    setEditingId(row.id);
    setEditingVersion(row.version ?? 1);
    setOpenStayCount(row.openInstanceCount ?? 0);
    setPinStayCount(row.pinInstanceCount ?? row.openInstanceCount ?? 0);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      minNights: row.minNights != null ? String(row.minNights) : "",
      maxNights: row.maxNights != null ? String(row.maxNights) : "",
      effectiveFrom: toYmd(row.effectiveFrom),
      effectiveTo: toYmd(row.effectiveTo),
    });
    setBlocks(
      (row.procedures ?? []).map((p, i) => {
        const code = p.procedureCode;
        const kind = inferBlockKind(code, (p.kind as BlockKind | null) ?? null);
        return {
          procedureCode: code,
          procedureName: p.procedureName,
          quotaTotal: p.quotaTotal,
          kind,
          sortOrder: p.sortOrder ?? i,
          memberCodes: Array.isArray(p.memberCodes) ? p.memberCodes : [],
          assignMode: (p.assignMode as AssignMode) || "MANUAL",
          fulfillment: fulfillmentFromKind(kind),
          quotaBasis: (p.quotaBasis as QuotaBasis) || "PER_NIGHTS",
          requiresDoctor: Boolean(p.requiresDoctor),
        };
      }),
    );
    setKnots(
      (row.quotaKnots ?? []).map((k) => ({
        nights: k.nights,
        procedureCode: k.procedureCode,
        qty: k.qty,
      })),
    );
    {
      const fromKnots = [
        ...new Set((row.quotaKnots ?? []).map((k) => k.nights).filter((n) => n > 0)),
      ].sort((a, b) => a - b);
      setMatrixNights(fromKnots.length > 0 ? fromKnots : [...KNOT_NIGHT_CHIPS]);
      if (fromKnots.length > 0) {
        const dur = row.durationDays;
        setKnotNights(String(fromKnots.includes(dur) ? dur : fromKnots[0]));
      }
    }
    setSaveError(null);
    closeBlockModal();
    setOpen(true);
  }

  function closeBlockModal() {
    setBlockModalOpen(false);
    setBlockOriginalCode(null);
    setBlockDraft(null);
    setBlockError(null);
    setMemberPick("");
    setLabCategory("");
    setMemberQuery("");
  }

  function openBlockCreate() {
    setBlockOriginalCode(null);
    setBlockDraft(emptyBlockDraft(blocks));
    setBlockError(null);
    setMemberPick("");
    setLabCategory("");
    setMemberQuery("");
    setBlockModalOpen(true);
  }

  function openBlockEdit(b: ProgramBlock) {
    const kind = inferBlockKind(b.procedureCode, b.kind);
    setBlockOriginalCode(b.procedureCode);
    setBlockDraft({
      ...b,
      kind,
      fulfillment: fulfillmentFromKind(kind),
      memberCodes: [...b.memberCodes],
    });
    setBlockError(null);
    setMemberPick("");
    setLabCategory("");
    setMemberQuery("");
    setBlockModalOpen(true);
  }

  function applyBlockKind(kind: BlockKind | null) {
    setMemberPick("");
    setLabCategory("");
    setMemberQuery("");
    setBlockDraft((prev) =>
      prev
        ? {
            ...prev,
            kind,
            fulfillment: kind ? fulfillmentFromKind(kind) : "",
          }
        : prev,
    );
  }

  function addMemberFromPick(code: string) {
    const c = code.trim();
    if (!c) {
      setMemberPick("");
      return;
    }
    setBlockDraft((prev) => {
      if (!prev) return prev;
      if (prev.memberCodes.includes(c)) return prev;
      return { ...prev, memberCodes: [...prev.memberCodes, c] };
    });
    setMemberPick("");
    setMemberQuery("");
  }

  function removeMemberChip(code: string) {
    setBlockDraft((prev) =>
      prev
        ? { ...prev, memberCodes: prev.memberCodes.filter((m) => m !== code) }
        : prev,
    );
  }

  function commitBlock() {
    if (!blockDraft) return;
    const code = blockDraft.procedureCode.trim();
    const name = blockDraft.procedureName.trim();
    if (
      !code ||
      !name ||
      !blockDraft.kind ||
      !blockDraft.assignMode ||
      !blockDraft.quotaBasis ||
      blockDraft.requiresDoctor === null
    ) {
      setBlockError(t("validationRequired"));
      return;
    }
    const conflict = blocks.some(
      (b) => b.procedureCode === code && b.procedureCode !== blockOriginalCode,
    );
    if (conflict) {
      setBlockError(t("duplicateBlockCode"));
      return;
    }

    const kind = inferBlockKind(code, blockDraft.kind);
    const prevCode = blockOriginalCode;
    const nextBlock: ProgramBlock = {
      ...blockDraft,
      procedureCode: code,
      procedureName: name,
      quotaTotal: Math.max(1, blockDraft.quotaTotal || 1),
      kind,
      fulfillment: fulfillmentFromKind(kind),
      memberCodes: [...blockDraft.memberCodes],
    };

    if (prevCode == null) {
      setBlocks((prev) => [...prev, { ...nextBlock, sortOrder: prev.length }]);
    } else {
      setBlocks((prev) =>
        prev.map((b) => (b.procedureCode === prevCode ? nextBlock : b)),
      );
      if (prevCode !== code) {
        setKnots((ks) =>
          ks.map((k) =>
            k.procedureCode === prevCode ? { ...k, procedureCode: code } : k,
          ),
        );
      }
    }

    closeBlockModal();
  }

  function removeBlock(code: string) {
    setBlocks((prev) => prev.filter((b) => b.procedureCode !== code));
    setKnots((prev) => prev.filter((k) => k.procedureCode !== code));
  }

  function procLabel(code: string): string {
    const hit = procTypes.find((p) => p.code === code);
    if (hit) return `${hit.code} · ${hit.name}`;
    const diag = diagItems.find((p) => p.code === code);
    if (diag) return `${diag.code} · ${pickL10n(diag.title, locale)}`;
    return code;
  }

  function procShortLabel(code: string): string {
    const hit = procTypes.find((p) => p.code === code);
    if (hit) return hit.name;
    const diag = diagItems.find((p) => p.code === code);
    if (diag) return pickL10n(diag.title, locale);
    return code;
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

  function setStayQty(procedureCode: string, qty: number) {
    const next = knots.filter((k) => k.procedureCode !== procedureCode);
    if (qty > 0) {
      for (const n of nightCols) {
        next.push({ nights: n, procedureCode, qty });
      }
    }
    setKnots(next);
  }

  function stayQty(procedureCode: string): number {
    const forCode = knots.filter((k) => k.procedureCode === procedureCode);
    if (forCode.length === 0) return 0;
    return forCode[0]?.qty ?? 0;
  }

  function addMatrixNight(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    setMatrixNights((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
    setKnotNights(String(n));
  }

  function removeMatrixNight(n: number) {
    const left = matrixNights.filter((x) => x !== n);
    setMatrixNights(left);
    setKnots((prev) => prev.filter((k) => k.nights !== n));
    if (Number(knotNights) === n) {
      setKnotNights(left.length ? String(left[0]) : "10");
    }
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
    if (
      form.effectiveFrom &&
      form.effectiveTo &&
      form.effectiveTo < form.effectiveFrom
    ) {
      setSaveError(t("validityRangeInvalid"));
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
      const validity = {
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
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
          assignMode: b.assignMode || "MANUAL",
          fulfillment: fulfillmentFromKind(b.kind),
          quotaBasis: b.quotaBasis || "PER_NIGHTS",
          requiresDoctor: Boolean(b.requiresDoctor),
        };
      });
      const payload = editingId
        ? {
            name,
            durationDays,
            ...nights,
            ...validity,
            procedures,
            knots,
          }
        : {
            code,
            name,
            durationDays,
            ...nights,
            ...validity,
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("validity")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("blocksCount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("openStays")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={9} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {tc("loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={9} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
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
                    <td className={DATA_TABLE_TD_CLASS}>
                      {formatYmd(row.effectiveFrom) || "—"}
                      {" – "}
                      {formatYmd(row.effectiveTo) || "∞"}
                      {isExpired(row) ? (
                        <span className={`ml-1 ${TEXT_MUTED_CLASS}`}>{t("expiredBadge")}</span>
                      ) : null}
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
        onClose={() => {
          closeBlockModal();
          setOpen(false);
        }}
        maxWidthClass="max-w-[76rem]"
      >
        <div className={`${FORM_STACK_CLASS} max-h-[min(70vh,42rem)] overflow-y-auto pr-1`}>
          {editingId ? (
            <p className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950`}>
              {pinStayCount > 0
                ? t("versionWarnOpen", {
                    version: editingVersion,
                    count: openStayCount > 0 ? openStayCount : pinStayCount,
                  })
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
              <Field
                label={t("code")}
                preset="code"
                value={form.code}
                readOnly
                disabled
              />
            )}
            <Field
              label={t("name")}
              preset="shortText"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[6.5rem] shrink-0">
              <Field
                label={t("durationDays")}
                preset="count"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              />
            </div>
            <div className="w-[6.5rem] shrink-0">
              <Field
                label={t("minNights")}
                preset="count"
                value={form.minNights}
                onChange={(e) => setForm({ ...form, minNights: e.target.value })}
              />
            </div>
            <div className="w-[6.5rem] shrink-0">
              <Field
                label={t("maxNights")}
                preset="count"
                value={form.maxNights}
                onChange={(e) => setForm({ ...form, maxNights: e.target.value })}
              />
            </div>
            <div className="min-w-[10.5rem] flex-1">
              <DatePicker
                label={t("effectiveFrom")}
                value={form.effectiveFrom}
                onChange={(isoDate) => setForm({ ...form, effectiveFrom: isoDate })}
                placeholder={tc("datePlaceholder")}
                openCalendarLabel={tc("openCalendar")}
                fluid
              />
            </div>
            <div className="min-w-[10.5rem] flex-1">
              <DatePicker
                label={t("effectiveTo")}
                value={form.effectiveTo}
                onChange={(isoDate) => setForm({ ...form, effectiveTo: isoDate })}
                placeholder={tc("datePlaceholder")}
                openCalendarLabel={tc("openCalendar")}
                hint={t("effectiveToHint")}
                fluid
              />
            </div>
          </div>

          <section className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800">{t("blocksMatrixTitle")}</h3>
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("blocksMatrixHint")}</p>
                <p className={`mt-1 text-[11px] ${TEXT_MUTED_CLASS}`}>{t("knotsRemoveHint")}</p>
              </div>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={openBlockCreate}>
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {t("addBlock")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
                <span className="shrink-0 font-medium">{t("customNights")}</span>
                <input
                  type="number"
                  min={1}
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-[13px]"
                  value={knotNights}
                  onChange={(e) => setKnotNights(e.target.value)}
                  aria-label={t("customNights")}
                />
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => addMatrixNight(Number(knotNights))}
                >
                  <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {t("addNight")}
                </button>
              </label>
            </div>
            {blocks.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addBlockFirst")}</p>
            ) : nightCols.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addNightFirst")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-[12px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-[1] min-w-[14rem] bg-white p-1 text-left">
                        {t("blockName")}
                      </th>
                      <th className="min-w-[4rem] p-1 text-center">{t("stayQty")}</th>
                      {nightCols.map((n) => (
                        <th key={n} className="p-1 text-center align-bottom">
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span>{n}n</span>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("removeNightColumn", { n })}
                              title={t("removeNightColumn", { n })}
                              onClick={() => removeMatrixNight(n)}
                            >
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="w-16 p-1 text-right">{tc("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixBlocks.map((b) => {
                      const kind = inferBlockKind(b.procedureCode, b.kind);
                      const chips = displayMemberCodes(b);
                      const chipPreview = chips.slice(0, 3);
                      const chipMore = chips.length - chipPreview.length;
                      const isStay = b.quotaBasis === "PER_STAY";
                      const isAuto =
                        b.assignMode === "AUTO_ON_OPEN" || b.assignMode === "AUTO_DAY1";
                      return (
                        <tr key={b.procedureCode} className="border-t border-slate-100 align-top">
                          <td className="sticky left-0 z-[1] bg-white p-1.5">
                            <p className="m-0 text-[13px] font-semibold text-slate-800">
                              {b.procedureName || b.procedureCode}
                              <span className={`ml-1 font-normal ${TEXT_MUTED_CLASS}`}>
                                ({b.procedureCode})
                              </span>
                              {isAuto ? (
                                <span
                                  className="ml-1 inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                                  title={t(`assignMode_${b.assignMode}`)}
                                >
                                  {t("autoBadge")}
                                </span>
                              ) : null}
                            </p>
                            <p className={`mb-0 mt-0.5 text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {defaultBlockName(kind, t)}
                              {" · "}
                              {t(`fulfillment_${fulfillmentFromKind(kind)}`)}
                            </p>
                            {chips.length === 0 ? (
                              <p className={`mb-0 mt-1 text-[11px] ${TEXT_MUTED_CLASS}`}>
                                {t("membersEmptyHint")}
                              </p>
                            ) : (
                              <div
                                className="mt-1 flex max-w-[16rem] flex-wrap gap-1"
                                aria-label={t("blockMembers")}
                              >
                                {chipPreview.map((c) => (
                                  <span
                                    key={c}
                                    className="inline-flex max-w-[7rem] truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-800"
                                    title={procLabel(c)}
                                  >
                                    {procShortLabel(c)}
                                  </span>
                                ))}
                                {chipMore > 0 ? (
                                  <span className={`text-[10px] ${TEXT_MUTED_CLASS}`}>
                                    {t("membersMore", { count: chipMore })}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="p-1 text-center">
                            {isStay ? (
                              <input
                                type="number"
                                min={0}
                                className="w-14 border px-1 py-0.5 text-center"
                                value={stayQty(b.procedureCode) || ""}
                                onChange={(e) =>
                                  setStayQty(b.procedureCode, Number(e.target.value) || 0)
                                }
                                aria-label={`${b.procedureCode} stay qty`}
                              />
                            ) : (
                              <span className={`text-[11px] ${TEXT_MUTED_CLASS}`}>—</span>
                            )}
                          </td>
                          {nightCols.map((n) => (
                            <td key={n} className="p-1 text-center">
                              {isStay ? (
                                <span className={`text-[11px] ${TEXT_MUTED_CLASS}`}>
                                  {stayQty(b.procedureCode) || "—"}
                                </span>
                              ) : (
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
                              )}
                            </td>
                          ))}
                          <td className="p-1">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className={TABLE_ROW_ICON_BTN_CLASS}
                                aria-label={tc("edit")}
                                onClick={() => openBlockEdit(b)}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                className={TABLE_ROW_ICON_BTN_CLASS}
                                aria-label={tc("delete")}
                                onClick={() => removeBlock(b.procedureCode)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {saveError ? <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{saveError}</p> : null}
        </div>
        <ModalFooter
          onCancel={() => {
            closeBlockModal();
            setOpen(false);
          }}
          onSubmit={() => void save()}
          submitLabel={tc("save")}
          submitDisabled={saving || blockModalOpen}
        />
      </ModalShell>

      <ModalShell
        open={blockModalOpen && !!blockDraft}
        title={blockOriginalCode == null ? t("addBlockTitle") : t("editBlockTitle")}
        onClose={closeBlockModal}
        maxWidthClass="max-w-lg"
      >
        {blockDraft ? (
          <div className={`${FORM_STACK_CLASS} max-h-[min(60vh,32rem)] overflow-y-auto pr-1`}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("blockKind")}
              value={blockDraft.kind ?? ""}
              onChange={(v) => {
                const next = String(v ?? "");
                applyBlockKind(next ? (next as BlockKind) : null);
              }}
              options={kindOptions}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("blockCode")}
                preset="code"
                value={blockDraft.procedureCode}
                onChange={(e) =>
                  setBlockDraft({ ...blockDraft, procedureCode: e.target.value })
                }
              />
              <Field
                label={t("blockName")}
                preset="shortText"
                value={blockDraft.procedureName}
                onChange={(e) =>
                  setBlockDraft({ ...blockDraft, procedureName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("assignMode")}
                value={blockDraft.assignMode}
                onChange={(v) =>
                  setBlockDraft({
                    ...blockDraft,
                    assignMode: String(v ?? "") as AssignMode | "",
                  })
                }
                options={assignModeOptions}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("quotaBasis")}
                value={blockDraft.quotaBasis}
                onChange={(v) =>
                  setBlockDraft({
                    ...blockDraft,
                    quotaBasis: String(v ?? "") as QuotaBasis | "",
                  })
                }
                options={quotaBasisOptions}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("requiresDoctor")}
                value={
                  blockDraft.requiresDoctor === null
                    ? ""
                    : blockDraft.requiresDoctor
                      ? "yes"
                      : "no"
                }
                onChange={(v) => {
                  const raw = String(v ?? "");
                  setBlockDraft({
                    ...blockDraft,
                    requiresDoctor: raw === "" ? null : raw === "yes",
                  });
                }}
                options={[
                  { value: "yes", label: t("requiresDoctorYes") },
                  { value: "no", label: t("requiresDoctorNo") },
                ]}
              />
            </div>

            <div className="space-y-2">
              {blockDraft.kind === "LAB" && labCategoryOptions.length > 1 ? (
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("labCategory")}
                  value={labCategory}
                  onChange={(v) => setLabCategory(String(v ?? ""))}
                  options={labCategoryOptions}
                />
              ) : null}
              <CatalogField
                kind="SEARCHABLE"
                label={t("addMember")}
                value={memberPick}
                onChange={(v) => addMemberFromPick(String(v ?? ""))}
                options={memberPickOptions}
                disabled={!blockDraft.kind}
                onQueryChange={blockDraft.kind === "CUSTOM" ? setMemberQuery : undefined}
                hint={
                  !blockDraft.kind
                    ? t("pickKindFirst")
                    : blockDraft.kind === "CUSTOM"
                      ? t("memberSearchMin", { n: CUSTOM_QUERY_MIN })
                      : t("blockMembersHint")
                }
              />
              {blockDraft.memberCodes.length === 0 ? (
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("membersEmptyHint")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5" aria-label={t("blockMembers")}>
                  {blockDraft.memberCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-[12px] text-slate-800"
                    >
                      <span className="truncate" title={procLabel(code)}>
                        {procShortLabel(code)}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        aria-label={t("removeMember", { name: procShortLabel(code) })}
                        onClick={() => removeMemberChip(code)}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {blockError ? (
              <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{blockError}</p>
            ) : null}
          </div>
        ) : null}
        <ModalFooter
          onCancel={closeBlockModal}
          onSubmit={commitBlock}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <ModalShell open={!!deleteId} title={tc("confirmDelete")} onClose={() => setDeleteId(null)}>
        <p className={`mb-3 text-[13px] ${TEXT_MUTED_CLASS}`}>
          {deleteTarget && (deleteTarget.pinInstanceCount ?? 0) > 0
            ? t("confirmCloseBody", {
                count: deleteTarget.pinInstanceCount ?? 0,
                date: formatYmd(todayYmd()),
              })
            : t("confirmDeleteBody")}
        </p>
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
