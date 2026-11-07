"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
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
  showApiError,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { pickL10n, type DiagnosticCatalogItem } from "@/domain/catalog/diagnostic-catalog-shared";
import { resolveDailyDistinctCap } from "@/domain/sanatorium/daily-package-cap";
import {
  CUSTOM_QUERY_MIN,
  filterCustomSkus,
  filterTreatmentSkus,
  fulfillmentFromKind,
  isLabBlockCatalogKind,
  PROGRAM_TEMPLATE_CATALOG_KINDS,
  type ProgramBlockFulfillment,
  type ProgramBlockKind,
} from "@/domain/sanatorium/program-block-catalog";

type BlockKind = ProgramBlockKind;
type AssignMode = "AUTO_ON_OPEN" | "AUTO_DAY1" | "ON_INDICATION" | "MANUAL";
type QuotaBasis = "PER_NIGHTS" | "PER_STAY";
type QuotaMode = "FIXED" | "DAILY_RATE";
type BlockQuotaMode = "DAILY_RATE" | "WEEKLY" | "PER_STAY";
type CreateWizardStep = 1 | 2 | 3;

type ProgramBlock = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  kind: BlockKind | null;
  sortOrder: number;
  memberCodes: string[];
  assignMode: AssignMode | "";
  fulfillment: ProgramBlockFulfillment | "";
  fulfillmentExplicit: boolean;
  quotaBasis: QuotaBasis | "";
  requiresDoctor: boolean | null;
  blockQuotaMode: BlockQuotaMode | null;
  dailyDistinctCap: number | null;
  quotaPerNight: number | null;
  quotaPerWeek: number | null;
  dailyUseCap: number | null;
  showInProcedures: boolean;
  procedureOrder: number;
};

function defaultUiBlockMode(
  kind: BlockKind | null,
  basis: QuotaBasis | "",
): BlockQuotaMode {
  if (kind === "LAB" || kind === "EXAM") return "PER_STAY";
  if (basis === "PER_STAY") return "PER_STAY";
  return "DAILY_RATE";
}

function resolveUiBlockMode(b: ProgramBlock): BlockQuotaMode {
  if (b.blockQuotaMode === "DAILY_RATE" || b.blockQuotaMode === "WEEKLY" || b.blockQuotaMode === "PER_STAY") {
    return b.blockQuotaMode;
  }
  return defaultUiBlockMode(b.kind, b.quotaBasis);
}

function ceilDailyPreview(nights: number, rate: number): number {
  if (!(rate > 0) || nights <= 0) return 0;
  return Math.ceil(nights * rate);
}

type ProgramKnot = { nights: number; procedureCode: string; qty: number };

type ProgramTemplate = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  minNights?: number | null;
  maxNights?: number | null;
  quotaMode?: QuotaMode | string | null;
  countSunday?: boolean | null;
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

type RecalcPreviewLine = {
  instanceId: string;
  episodeId: string;
  programCode: string;
  patientLabel: string;
  procedureCode: string;
  procedureName: string;
  quotaUsed: number;
  quotaTotalBefore: number;
  quotaTotalAfter: number;
  flooredAtUsed: boolean;
};

type ProcTypeOpt = { code: string; name: string; blockCategory?: string | null };

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

function newBlockCode(): string {
  const id = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `BLK-${id}`;
}

function nextProcedureOrder(existing: ProgramBlock[]): number {
  const used = existing.filter((row) => row.showInProcedures).map((row) => row.procedureOrder);
  return used.length > 0 ? Math.max(...used) + 1 : 1;
}

function emptyBlockDraft(existing: ProgramBlock[]): ProgramBlock {
  return {
    procedureCode: newBlockCode(),
    procedureName: "",
    quotaTotal: 1,
    kind: null,
    sortOrder: existing.length,
    memberCodes: [],
    assignMode: "",
    fulfillment: "",
    fulfillmentExplicit: false,
    quotaBasis: "",
    requiresDoctor: null,
    blockQuotaMode: "DAILY_RATE",
    dailyDistinctCap: null,
    quotaPerNight: 1,
    quotaPerWeek: null,
    dailyUseCap: 1,
    showInProcedures: false,
    procedureOrder: 0,
  };
}

/** Codes shown as chips under a block row (members, else self for single-SKU lines). */
function displayMemberCodes(b: ProgramBlock): string[] {
  if (b.memberCodes.length > 0) return b.memberCodes;
  if (isEntitlementPoolOrAlias(b.procedureCode)) return [];
  return b.procedureCode.trim() ? [b.procedureCode] : [];
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lab panels expand to analyte names. Other members stay one line each. */
function blockCompositionLines(
  block: ProgramBlock,
  diagItems: DiagnosticCatalogItem[],
  procTypes: ProcTypeOpt[],
  locale: string,
): string[] {
  const rows: string[] = [];
  for (const code of displayMemberCodes(block)) {
    const diag = diagItems.find((item) => item.code === code);
    if (diag && (diag.analytes?.length ?? 0) > 0) {
      for (const analyte of diag.analytes ?? []) {
        rows.push(pickL10n(analyte.label, locale));
      }
      continue;
    }
    if (diag) {
      rows.push(pickL10n(diag.title, locale));
      continue;
    }
    rows.push(procTypes.find((item) => item.code === code)?.name || code);
  }
  return rows.length > 0 ? rows : ["—"];
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
    quotaMode: "" as QuotaMode | "",
    countSunday: false,
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
  const [memberPick, setMemberPick] = useState("");
  /** Create wizard: 1 identity → 2 type → 3 composition. Null when editing. */
  const [createStep, setCreateStep] = useState<CreateWizardStep | null>(null);
  const [recalcPreview, setRecalcPreview] = useState<{
    openCourseCount: number;
    lines: RecalcPreviewLine[];
  } | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = includeRetired ? "?includeRetired=1" : "";
      const [pRes, ptRes, diagRes] = await Promise.all([
        fetch(`/api/admin/program-templates${qs}`),
        fetch(`/api/admin/procedure-types?locale=${encodeURIComponent(locale)}`),
        fetch(
          `/api/diagnostic-catalog?kinds=${PROGRAM_TEMPLATE_CATALOG_KINDS.join(",")}&applyFavorites=false`,
        ),
      ]);
      if (!pRes.ok) {
        setRows([]);
        showApiError(await pRes.json().catch(() => ({})), tc("failed"));
        return;
      }
      const pJson = await pRes.json();
      const list = (pJson.data ?? pJson) as ProgramTemplate[];
      setRows(Array.isArray(list) ? list : []);

      if (ptRes.ok) {
        const ptJson = await ptRes.json();
        const ptRaw = (ptJson.data ?? ptJson) as
          | Array<{ code: string; name?: string; blockCategory?: string | null }>
          | { items?: Array<{ code: string; name?: string; blockCategory?: string | null }> };
        const ptList = Array.isArray(ptRaw) ? ptRaw : (ptRaw.items ?? []);
        const seen = new Set<string>();
        const unique: ProcTypeOpt[] = [];
        for (const x of Array.isArray(ptList) ? ptList : []) {
          const code = String(x.code ?? "").trim();
          if (!code) continue;
          const key = code.normalize("NFC").toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push({ code, name: x.name ?? code, blockCategory: x.blockCategory ?? null });
        }
        unique.sort((a, b) => a.code.localeCompare(b.code));
        setProcTypes(unique);
      }
      if (diagRes.ok) {
        const diagJson = await diagRes.json();
        const payload = (diagJson.data ?? diagJson) as { items?: DiagnosticCatalogItem[] };
        setDiagItems(
          Array.isArray(payload.items)
            ? payload.items.filter((item) => item.categoryActive !== false)
            : [],
        );
      }
    } catch {
      setRows([]);
      showApiError({ error: tc("failed") });
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
        if (!isLabBlockCatalogKind(o.kind)) return false;
        if (o.kind === "lab_panel" && labCategory && o.category !== labCategory) return false;
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
    setCreateStep(1);
    setRecalcPreview(null);
    closeBlockModal();
    setOpen(true);
  }

  function openEdit(row: ProgramTemplate) {
    setEditingId(row.id);
    setEditingVersion(row.version ?? 1);
    setOpenStayCount(row.openInstanceCount ?? 0);
    setPinStayCount(row.pinInstanceCount ?? row.openInstanceCount ?? 0);
    setCreateStep(null);
    setRecalcPreview(null);
    setForm({
      code: row.code,
      name: row.name,
      durationDays: String(row.durationDays),
      minNights: row.minNights != null ? String(row.minNights) : "",
      maxNights: row.maxNights != null ? String(row.maxNights) : "",
      quotaMode: row.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED",
      countSunday: Boolean(row.countSunday),
      effectiveFrom: toYmd(row.effectiveFrom),
      effectiveTo: toYmd(row.effectiveTo),
    });
    setBlocks(
      (row.procedures ?? []).map((p, i) => {
        const code = p.procedureCode;
        const kind = inferBlockKind(code, (p.kind as BlockKind | null) ?? null);
        const basis = (p.quotaBasis as QuotaBasis) || "PER_NIGHTS";
        const modeRaw = (p as ProgramBlock).blockQuotaMode;
        const blockQuotaMode =
          modeRaw === "DAILY_RATE" || modeRaw === "WEEKLY" || modeRaw === "PER_STAY"
            ? modeRaw
            : defaultUiBlockMode(kind, basis);
        const startRate =
          p.quotaPerNight != null && Number(p.quotaPerNight) > 0
            ? Number(p.quotaPerNight)
            : p.dailyDistinctCap != null && p.dailyDistinctCap >= 1
              ? p.dailyDistinctCap
              : 1;
        return {
          procedureCode: code,
          procedureName: p.procedureName,
          quotaTotal: p.quotaTotal,
          kind,
          sortOrder: p.sortOrder ?? i,
          memberCodes: Array.isArray(p.memberCodes) ? p.memberCodes : [],
          assignMode: (p.assignMode as AssignMode) || "MANUAL",
          fulfillment:
            p.fulfillment === "LAB_ORDER" ||
            p.fulfillment === "VISIT" ||
            (p.fulfillment === "PROCEDURE_ORDER" && p.fulfillmentExplicit)
              ? p.fulfillment
              : fulfillmentFromKind(kind),
          fulfillmentExplicit: p.fulfillmentExplicit === true,
          quotaBasis: basis,
          requiresDoctor: Boolean(p.requiresDoctor),
          blockQuotaMode,
          dailyDistinctCap: p.dailyDistinctCap ?? null,
          quotaPerNight: p.quotaPerNight != null ? Number(p.quotaPerNight) : startRate,
          quotaPerWeek:
            (p as ProgramBlock).quotaPerWeek != null
              ? Number((p as ProgramBlock).quotaPerWeek)
              : null,
          dailyUseCap: p.dailyUseCap ?? Math.max(1, Math.ceil(startRate)),
          showInProcedures: p.showInProcedures === true,
          procedureOrder: p.procedureOrder ?? p.sortOrder ?? i,
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
    closeBlockModal();
    setOpen(true);
  }

  function closeBlockModal() {
    setBlockModalOpen(false);
    setBlockOriginalCode(null);
    setBlockDraft(null);
    setMemberPick("");
    setLabCategory("");
    setMemberQuery("");
  }

  function openBlockCreate() {
    setBlockOriginalCode(null);
    setBlockDraft(emptyBlockDraft(blocks));
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
      fulfillment: b.fulfillment || fulfillmentFromKind(kind),
      memberCodes: [...b.memberCodes],
    });
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
            blockQuotaMode:
              isDailyRate || editingId != null
                ? defaultUiBlockMode(kind, prev.quotaBasis)
                : prev.blockQuotaMode,
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
      showApiError({ error: t("validationRequired") });
      return;
    }
    if (isDailyRate || (editingId != null && !isDailyRate)) {
      const mode = resolveUiBlockMode(blockDraft);
      if (mode === "DAILY_RATE") {
        const rate = Number(blockDraft.quotaPerNight);
        if (!Number.isFinite(rate) || rate <= 0) {
          showApiError({ error: t("quotaPerNightRequired") });
          return;
        }
      } else if (mode === "WEEKLY") {
        const per = Number(blockDraft.quotaPerWeek);
        if (!Number.isFinite(per) || per < 1) {
          showApiError({ error: t("quotaPerWeekRequired") });
          return;
        }
      } else if (
        !Number.isFinite(Number(blockDraft.quotaTotal)) ||
        Number(blockDraft.quotaTotal) < 1
      ) {
        showApiError({ error: t("stayQtyRequired") });
        return;
      }
    }
    const conflict = blocks.some(
      (b) => b.procedureCode === code && b.procedureCode !== blockOriginalCode,
    );
    if (conflict) {
      showApiError({ error: t("duplicateBlockCode") });
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
      fulfillment: blockDraft.fulfillment || fulfillmentFromKind(kind),
      fulfillmentExplicit: true,
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

  function printPackageSheet() {
    const title = form.name.trim() || form.code.trim() || t("title");
    const nights =
      form.minNights || form.maxNights
        ? `${form.minNights || "—"}–${form.maxNights || "—"}`
        : form.durationDays;
    const from = formatYmd(form.effectiveFrom) || "—";
    const to = formatYmd(form.effectiveTo) || "—";
    const modeLabel = isDailyRate ? t("quotaMode_DAILY_RATE") : t("quotaMode_FIXED");
    const head = isDailyRate
      ? `<th class="day">${htmlEscape(t("blockQuotaMode"))}</th><th class="day">${htmlEscape(t("blockQuotaValue"))}</th><th class="day">${htmlEscape(t("dailyUseCap"))}</th>`
      : nightCols
          .map((n) => `<th class="day">${htmlEscape(t("printNight", { n }))}</th>`)
          .join("");
    const body = matrixBlocks
      .map((block) => {
        const items = blockCompositionLines(block, diagItems, procTypes, locale)
          .map((line) => `<li>${htmlEscape(line)}</li>`)
          .join("");
        const blockMode = resolveUiBlockMode(block);
        const days = isDailyRate
          ? (() => {
              const value =
                blockMode === "WEEKLY"
                  ? `${Math.max(1, Math.floor(Number(block.quotaPerWeek) || 1))}/${t("blockQuotaMode_WEEKLY_unit")}`
                  : blockMode === "PER_STAY"
                    ? String(Math.max(1, Math.floor(Number(block.quotaTotal) || 1)))
                    : String(Number(block.quotaPerNight) || 0);
              const dayCap =
                blockMode === "DAILY_RATE"
                  ? String(
                      Math.max(
                        1,
                        Math.floor(
                          Number(block.dailyUseCap) ||
                            Math.ceil(Number(block.quotaPerNight) || 1),
                        ),
                      ),
                    )
                  : "—";
              return `<td class="day">${htmlEscape(t(`blockQuotaMode_${blockMode}`))}</td>
             <td class="day">${htmlEscape(value)}</td>
             <td class="day">${htmlEscape(dayCap)}</td>`;
            })()
          : nightCols
              .map((n) => {
                const qty =
                  block.quotaBasis === "PER_STAY"
                    ? stayQty(block.procedureCode)
                    : knotQty(n, block.procedureCode);
                return `<td class="day">${qty > 0 ? qty : "—"}</td>`;
              })
              .join("");
        const mode = block.assignMode ? t(`assignMode_${block.assignMode}`) : "—";
        const basis = isDailyRate
          ? t(`blockQuotaMode_${blockMode}`)
          : block.quotaBasis
            ? t(`quotaBasis_${block.quotaBasis}`)
            : "—";
        return `<tr>
          <td class="name"><strong>${htmlEscape(block.procedureName || block.procedureCode)}</strong></td>
          <td><ul>${items}</ul></td>
          <td>${htmlEscape(mode)}</td>
          <td>${htmlEscape(basis)}</td>
          ${days}
        </tr>`;
      })
      .join("");
    const sundayNote = isDailyRate
      ? ` · ${form.countSunday ? t("countSundayOnShort") : t("countSundayOffShort")}`
      : "";
    const html = `<!DOCTYPE html><html lang="${htmlEscape(locale)}"><head><meta charset="utf-8"/><title>${htmlEscape(title)}</title>
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 10px; }
h1 { font-size: 16px; margin: 0 0 2px; }
.meta { margin: 0 0 8px; color: #444; font-size: 11px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #c8c8c8; padding: 4px 6px; vertical-align: top; }
th { background: #f3f1ea; text-align: left; font-size: 10px; }
td.day, th.day { width: 1%; text-align: center; white-space: nowrap; padding: 3px 4px; }
td.day { font-weight: 700; font-size: 11px; }
th.day { font-weight: 600; font-size: 9px; }
.code { color: #666; font-size: 9px; margin-top: 2px; }
ul { margin: 0; padding-left: 14px; } li { margin: 0; }
</style></head><body>
<h1>${htmlEscape(title)}</h1>
<p class="meta">${htmlEscape(form.code)} · v${editingVersion} · ${htmlEscape(modeLabel)}${htmlEscape(sundayNote)} · ${htmlEscape(nights)} · ${htmlEscape(from)} — ${htmlEscape(to)}</p>
<table><thead><tr>
<th>${htmlEscape(t("blockName"))}</th>
<th>${htmlEscape(t("printComposition"))}</th>
<th>${htmlEscape(t("printAssign"))}</th>
<th>${htmlEscape(t("printQuotaType"))}</th>
${head}
</tr></thead><tbody>${body}</tbody></table>
<script>setTimeout(function(){window.print()},0)<\/script>
</body></html>`;
    const sheet = window.open("", "_blank");
    if (!sheet) {
      showApiError({ error: t("printBlocked") });
      return;
    }
    sheet.document.open();
    sheet.document.write(html);
    sheet.document.close();
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

  const isDailyRate = form.quotaMode === "DAILY_RATE";
  const showComposition = editingId != null || createStep === 3;

  async function save() {
    const name = form.name.trim();
    const code = form.code.trim();
    const durationDays = Number(form.durationDays);
    const quotaMode: QuotaMode = form.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED";
    if (!name || (!editingId && !code) || !Number.isFinite(durationDays) || durationDays < 1) {
      showApiError({ error: t("validationRequired") });
      return;
    }
    if (!editingId && !form.quotaMode) {
      showApiError({ error: t("quotaModeRequired") });
      return;
    }
    if (
      form.effectiveFrom &&
      form.effectiveTo &&
      form.effectiveTo < form.effectiveFrom
    ) {
      showApiError({ error: t("validityRangeInvalid") });
      return;
    }
    if (blocks.length === 0) {
      showApiError({ error: t("addBlockFirst") });
      return;
    }
    const codes = new Set<string>();
    for (const b of blocks) {
      if (!b.procedureCode.trim()) {
        showApiError({ error: t("validationRequired") });
        return;
      }
      if (codes.has(b.procedureCode)) {
        showApiError({ error: t("duplicateBlockCode") });
        return;
      }
      codes.add(b.procedureCode);
      if (quotaMode === "DAILY_RATE") {
        const mode = resolveUiBlockMode(b);
        if (mode === "DAILY_RATE") {
          const rate = Number(b.quotaPerNight);
          if (!Number.isFinite(rate) || rate <= 0) {
            showApiError({ error: t("quotaPerNightRequired") });
            return;
          }
        } else if (mode === "WEEKLY") {
          const per = Number(b.quotaPerWeek);
          if (!Number.isFinite(per) || per < 1) {
            showApiError({ error: t("quotaPerWeekRequired") });
            return;
          }
        } else if (!Number.isFinite(Number(b.quotaTotal)) || Number(b.quotaTotal) < 1) {
          showApiError({ error: t("stayQtyRequired") });
          return;
        }
      }
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
        const blockMode =
          quotaMode === "DAILY_RATE" ? resolveUiBlockMode(b) : null;
        const rate = Number(b.quotaPerNight);
        const useCap = Math.max(
          1,
          Math.floor(Number(b.dailyUseCap) || Math.ceil(rate > 0 ? rate : 1)),
        );
        const week = Math.max(1, Math.floor(Number(b.quotaPerWeek) || 1));
        const quotaTotal =
          quotaMode === "DAILY_RATE"
            ? blockMode === "PER_STAY"
              ? Math.max(1, Math.floor(Number(b.quotaTotal) || 1))
              : blockMode === "WEEKLY"
                ? Math.max(1, week)
                : Math.max(1, ceilDailyPreview(durationDays, rate > 0 ? rate : 1))
            : knotQtys.length > 0
              ? Math.max(...knotQtys, 1)
              : Math.max(1, b.quotaTotal || 1);
        return {
          procedureCode: b.procedureCode.trim(),
          procedureName: b.procedureName.trim() || b.procedureCode,
          quotaTotal,
          kind: b.kind,
          sortOrder: b.sortOrder ?? i,
          memberCodes: b.memberCodes,
          assignMode: b.assignMode || "MANUAL",
          fulfillment: b.fulfillment || fulfillmentFromKind(b.kind),
          fulfillmentExplicit: b.fulfillmentExplicit === true,
          quotaBasis: b.quotaBasis || "PER_NIGHTS",
          requiresDoctor: Boolean(b.requiresDoctor),
          showInProcedures: b.showInProcedures === true,
          procedureOrder: b.showInProcedures ? Math.max(1, b.procedureOrder || 0) : 0,
          dailyDistinctCap:
            b.kind === "PHYSIO" || b.kind === "BATH" || b.kind === "PARAFFIN"
              ? b.dailyDistinctCap
              : null,
          blockQuotaMode: blockMode,
          quotaPerNight:
            quotaMode === "DAILY_RATE" && blockMode === "DAILY_RATE"
              ? rate
              : null,
          quotaPerWeek:
            quotaMode === "DAILY_RATE" && blockMode === "WEEKLY" ? week : null,
          dailyUseCap:
            quotaMode === "DAILY_RATE" && blockMode === "DAILY_RATE"
              ? useCap
              : null,
        };
      });
      const payload = editingId
        ? {
            name,
            durationDays,
            quotaMode,
            countSunday: quotaMode === "DAILY_RATE" ? form.countSunday : false,
            ...nights,
            ...validity,
            procedures,
            knots: quotaMode === "DAILY_RATE" ? [] : knots,
          }
        : {
            code,
            name,
            durationDays,
            quotaMode,
            countSunday: quotaMode === "DAILY_RATE" ? form.countSunday : false,
            ...nights,
            ...validity,
            procedures,
            knots: quotaMode === "DAILY_RATE" ? [] : knots,
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
        showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
      setOpen(false);
      setCreateStep(null);
      setPage(1);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function previewRecalc() {
    if (!editingId) return;
    setRecalcBusy(true);
    try {
      const res = await fetch(
        `/api/admin/program-templates/${editingId}?action=preview-recalc`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("failed"));
        return;
      }
      const json = await res.json();
      const data = (json.data ?? json) as {
        openCourseCount: number;
        lines: RecalcPreviewLine[];
      };
      setRecalcPreview({
        openCourseCount: data.openCourseCount ?? 0,
        lines: Array.isArray(data.lines) ? data.lines : [],
      });
    } finally {
      setRecalcBusy(false);
    }
  }

  async function applyRecalc() {
    if (!editingId) return;
    setRecalcBusy(true);
    try {
      const res = await fetch(
        `/api/admin/program-templates/${editingId}?action=apply-recalc`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("failed"));
        return;
      }
      setRecalcPreview(null);
      await load();
    } finally {
      setRecalcBusy(false);
    }
  }

  async function publishAsDaily() {
    if (!editingId || form.quotaMode === "DAILY_RATE") return;
    for (const b of blocks) {
      const mode = resolveUiBlockMode({
        ...b,
        blockQuotaMode: b.blockQuotaMode ?? defaultUiBlockMode(b.kind, b.quotaBasis),
      });
      if (mode === "DAILY_RATE") {
        const rate = Number(b.quotaPerNight);
        if (!Number.isFinite(rate) || rate <= 0) {
          showApiError({ error: t("quotaPerNightRequired") });
          return;
        }
      } else if (mode === "WEEKLY") {
        const per = Number(b.quotaPerWeek);
        if (!Number.isFinite(per) || per < 1) {
          showApiError({ error: t("quotaPerWeekRequired") });
          return;
        }
      } else if (!Number.isFinite(Number(b.quotaTotal)) || Number(b.quotaTotal) < 1) {
        showApiError({ error: t("stayQtyRequired") });
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/program-templates/${editingId}?action=publish-daily`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countSunday: form.countSunday,
            blocks: blocks.map((b) => {
              const mode = resolveUiBlockMode({
                ...b,
                blockQuotaMode:
                  b.blockQuotaMode ??
                  defaultUiBlockMode(b.kind, b.quotaBasis),
              });
              const rate =
                Number(b.quotaPerNight) > 0
                  ? Number(b.quotaPerNight)
                  : Number(b.dailyDistinctCap) > 0
                    ? Number(b.dailyDistinctCap)
                    : 1;
              return {
                procedureCode: b.procedureCode,
                blockQuotaMode: mode,
                quotaPerNight: mode === "DAILY_RATE" ? rate : undefined,
                quotaPerWeek:
                  mode === "WEEKLY"
                    ? Math.max(1, Math.floor(Number(b.quotaPerWeek) || 1))
                    : undefined,
                quotaTotal:
                  mode === "PER_STAY"
                    ? Math.max(1, Math.floor(Number(b.quotaTotal) || 1))
                    : undefined,
                dailyUseCap:
                  mode === "DAILY_RATE"
                    ? Math.max(1, Math.floor(Number(b.dailyUseCap) || Math.ceil(rate)))
                    : null,
              };
            }),
          }),
        },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
      const json = await res.json();
      const row = (json.data ?? json) as ProgramTemplate;
      setOpen(false);
      setCreateStep(null);
      await load();
      if (row?.id) openEdit(row);
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
        showApiError(await res.json().catch(() => ({})), tc("failed"));
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
              <Plus className="h-4 w-4" aria-hidden />
              {tc("add")}
            </button>
          </div>
        }
      />

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("quotaMode")}</th>
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
                  <td colSpan={10} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {tc("loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={10} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.quotaMode === "DAILY_RATE"
                        ? t("quotaMode_DAILY_RATE")
                        : t("quotaMode_FIXED")}
                    </td>
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
            : createStep
              ? t("wizardTitle", { step: createStep })
              : tc("add")
        }
        onClose={() => {
          closeBlockModal();
          setCreateStep(null);
          setRecalcPreview(null);
          setOpen(false);
        }}
        closeLabel={tc("close")}
        headerActions={
          showComposition ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={printPackageSheet}
              aria-label={t("printSheet")}
            >
              <Printer className="h-4 w-4" aria-hidden />
              {t("printSheet")}
            </button>
          ) : null
        }
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

          {!editingId && createStep === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("code")}
                preset="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Field
                label={t("name")}
                preset="shortText"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          ) : null}

          {!editingId && createStep === 2 ? (
            <div className="space-y-3">
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("quotaModeStepHint")}</p>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("quotaMode")}
                value={form.quotaMode}
                onChange={(v) =>
                  setForm({
                    ...form,
                    quotaMode: (String(v ?? "") as QuotaMode | "") || "",
                  })
                }
                options={[
                  { value: "FIXED", label: t("quotaMode_FIXED") },
                  { value: "DAILY_RATE", label: t("quotaMode_DAILY_RATE") },
                ]}
              />
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {form.quotaMode === "DAILY_RATE"
                  ? t("quotaMode_DAILY_RATE_hint")
                  : form.quotaMode === "FIXED"
                    ? t("quotaMode_FIXED_hint")
                    : t("quotaModePick")}
              </p>
            </div>
          ) : null}

          {showComposition ? (
            <>
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
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-700">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
              {t(isDailyRate ? "quotaMode_DAILY_RATE" : "quotaMode_FIXED")}
            </span>
            {editingId && !isDailyRate ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void publishAsDaily()}
              >
                {t("publishAsDaily")}
              </button>
            ) : null}
            {editingId && isDailyRate ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={recalcBusy || saving}
                onClick={() => void previewRecalc()}
              >
                {t("recalcQuotas")}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[6.5rem] shrink-0">
              <Field
                label={t("durationNights")}
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
            {isDailyRate || (editingId != null && !isDailyRate) ? (
              <label className="inline-flex items-center gap-2 pb-2 text-[12px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.countSunday}
                  onChange={(e) => setForm({ ...form, countSunday: e.target.checked })}
                />
                <span>
                  {t("countSunday")}
                  <span className={`ml-1 ${TEXT_MUTED_CLASS}`}>{t("countSundayHint")}</span>
                </span>
              </label>
            ) : null}
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
                <h3 className="text-[13px] font-semibold text-slate-800">
                  {isDailyRate ? t("blocksDailyTitle") : t("blocksMatrixTitle")}
                </h3>
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {isDailyRate ? t("blocksDailyHint") : t("blocksMatrixHint")}
                </p>
                {!isDailyRate ? (
                  <p className={`mt-1 text-[11px] ${TEXT_MUTED_CLASS}`}>{t("knotsRemoveHint")}</p>
                ) : null}
              </div>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={openBlockCreate}>
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {t("addBlock")}
              </button>
            </div>
            {!isDailyRate ? (
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
            ) : null}
            {blocks.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addBlockFirst")}</p>
            ) : null}
            {!isDailyRate && blocks.length > 0 && nightCols.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("addNightFirst")}</p>
            ) : null}
            {!isDailyRate && blocks.length > 0 && nightCols.length > 0 ? (
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
                      <th className="w-16 p-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {matrixBlocks.map((b) => {
                      const isStay = b.quotaBasis === "PER_STAY";
                      return (
                        <tr key={b.procedureCode} className="border-t border-slate-100">
                          <td className="sticky left-0 z-[1] bg-white p-1">
                            <div className="font-medium text-slate-800">
                              {b.procedureName || b.procedureCode}
                            </div>
                            <div className={`text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {defaultBlockName(inferBlockKind(b.procedureCode, b.kind), t)}
                            </div>
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
                                aria-label={`${b.procedureName || b.procedureCode} stay qty`}
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
                                  aria-label={`${b.procedureName || b.procedureCode} ${n}n`}
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
            ) : null}
            {(isDailyRate || (editingId != null && !isDailyRate)) && blocks.length > 0 ? (
              <div className="space-y-2">
                {!isDailyRate ? (
                  <div className="rounded border border-amber-200 bg-amber-50/80 px-2.5 py-2">
                    <p className="m-0 text-[13px] font-semibold text-slate-800">
                      {t("publishCutoverTitle")}
                    </p>
                    <p className={`mb-0 mt-0.5 text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {t("publishCutoverHint")}
                    </p>
                  </div>
                ) : null}
                {matrixBlocks.map((b) => {
                  const mode = resolveUiBlockMode(b);
                  const rate = Number(b.quotaPerNight) > 0 ? Number(b.quotaPerNight) : 1;
                  const week = Math.max(1, Math.floor(Number(b.quotaPerWeek) || 1));
                  const useCap = Math.max(1, Math.floor(Number(b.dailyUseCap) || Math.ceil(rate)));
                  const exampleNights = Math.max(
                    1,
                    Number(form.minNights) || Number(form.durationDays) || 10,
                  );
                  const exampleTotal =
                    mode === "WEEKLY"
                      ? Math.floor(exampleNights / 7) * week
                      : mode === "PER_STAY"
                        ? Math.max(1, Math.floor(Number(b.quotaTotal) || 1))
                        : ceilDailyPreview(exampleNights, rate);
                  return (
                    <div
                      key={b.procedureCode}
                      className="rounded border border-slate-200 bg-white p-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="m-0 text-[13px] font-semibold text-slate-800">
                            {b.procedureName || b.procedureCode}
                          </p>
                          <p className={`mb-0 mt-0.5 text-[11px] ${TEXT_MUTED_CLASS}`}>
                            {defaultBlockName(inferBlockKind(b.procedureCode, b.kind), t)}
                            {" · "}
                            {t(`blockQuotaMode_${mode}`)}
                            {" · "}
                            {t("dailyDistinctCapShort", {
                              n: resolveDailyDistinctCap(
                                inferBlockKind(b.procedureCode, b.kind),
                                b.dailyDistinctCap,
                              ),
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openBlockEdit(b)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t("blockQuotaMode")}
                          value={mode}
                          onChange={(v) => {
                            const next = String(v ?? "") as BlockQuotaMode;
                            setBlocks((prev) =>
                              prev.map((row) =>
                                row.procedureCode === b.procedureCode
                                  ? {
                                      ...row,
                                      blockQuotaMode: next,
                                      quotaPerWeek:
                                        next === "WEEKLY"
                                          ? Math.max(1, Number(row.quotaPerWeek) || 1)
                                          : row.quotaPerWeek,
                                      quotaPerNight:
                                        next === "DAILY_RATE"
                                          ? Number(row.quotaPerNight) > 0
                                            ? Number(row.quotaPerNight)
                                            : 1
                                          : row.quotaPerNight,
                                    }
                                  : row,
                              ),
                            );
                          }}
                          options={(["DAILY_RATE", "WEEKLY", "PER_STAY"] as const).map(
                            (value) => ({
                              value,
                              label: t(`blockQuotaMode_${value}`),
                            }),
                          )}
                        />
                        {mode === "DAILY_RATE" ? (
                          <label className="block text-[12px] text-slate-700">
                            <span className="font-medium">{t("quotaPerNight")}</span>
                            <input
                              type="number"
                              min={0.01}
                              max={12}
                              step={0.01}
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[13px]"
                              value={b.quotaPerNight ?? 1}
                              onChange={(e) => {
                                const n = Math.max(0.01, Number(e.target.value) || 0.01);
                                setBlocks((prev) =>
                                  prev.map((row) =>
                                    row.procedureCode === b.procedureCode
                                      ? {
                                          ...row,
                                          quotaPerNight: n,
                                          dailyUseCap:
                                            row.dailyUseCap == null ||
                                            row.dailyUseCap ===
                                              Math.ceil(Number(row.quotaPerNight) || 1)
                                              ? Math.max(1, Math.ceil(n))
                                              : row.dailyUseCap,
                                        }
                                      : row,
                                  ),
                                );
                              }}
                            />
                            <span className={`mt-0.5 block text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {t("quotaPerNightHint")}
                            </span>
                          </label>
                        ) : null}
                        {mode === "WEEKLY" ? (
                          <label className="block text-[12px] text-slate-700">
                            <span className="font-medium">{t("quotaPerWeek")}</span>
                            <input
                              type="number"
                              min={1}
                              max={21}
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[13px]"
                              value={b.quotaPerWeek ?? 1}
                              onChange={(e) => {
                                const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                setBlocks((prev) =>
                                  prev.map((row) =>
                                    row.procedureCode === b.procedureCode
                                      ? { ...row, quotaPerWeek: n }
                                      : row,
                                  ),
                                );
                              }}
                            />
                            <span className={`mt-0.5 block text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {t("quotaPerWeekHint")}
                            </span>
                          </label>
                        ) : null}
                        {mode === "PER_STAY" ? (
                          <label className="block text-[12px] text-slate-700">
                            <span className="font-medium">{t("stayQty")}</span>
                            <input
                              type="number"
                              min={1}
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[13px]"
                              value={b.quotaTotal ?? 1}
                              onChange={(e) => {
                                const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                setBlocks((prev) =>
                                  prev.map((row) =>
                                    row.procedureCode === b.procedureCode
                                      ? { ...row, quotaTotal: n }
                                      : row,
                                  ),
                                );
                              }}
                            />
                          </label>
                        ) : null}
                        {mode === "DAILY_RATE" ? (
                          <label className="block text-[12px] text-slate-700">
                            <span className="font-medium">{t("dailyUseCap")}</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[13px]"
                              value={b.dailyUseCap ?? Math.ceil(rate)}
                              onChange={(e) => {
                                const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                setBlocks((prev) =>
                                  prev.map((row) =>
                                    row.procedureCode === b.procedureCode
                                      ? { ...row, dailyUseCap: n }
                                      : row,
                                  ),
                                );
                              }}
                            />
                            <span className={`mt-0.5 block text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {t("dailyUseCapHint")}
                            </span>
                          </label>
                        ) : null}
                      </div>
                      <p className={`mb-0 mt-1 text-[11px] ${TEXT_MUTED_CLASS}`}>
                        {mode === "DAILY_RATE"
                          ? t("dailyRateExample", {
                              nights: exampleNights,
                              total: exampleTotal,
                              dayCap: useCap,
                              sunday: form.countSunday
                                ? t("countSundayOnShort")
                                : t("countSundayOffShort"),
                            })
                          : mode === "WEEKLY"
                            ? t("weeklyRateExample", {
                                nights: exampleNights,
                                weeks: Math.floor(exampleNights / 7),
                                total: exampleTotal,
                              })
                            : t("perStayExample", { total: exampleTotal })}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
            </>
          ) : null}

          {recalcPreview ? (
            <section className={`${FIELD_SECTION_CLASS} space-y-2 p-3`}>
              <h3 className="text-[13px] font-semibold text-slate-800">{t("recalcPreviewTitle")}</h3>
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {recalcPreview.openCourseCount === 0
                  ? t("recalcNoOpen")
                  : t("recalcPreviewHint", { count: recalcPreview.openCourseCount })}
              </p>
              <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{t("recalcClosedStay")}</p>
              {recalcPreview.lines.length > 0 ? (
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <th className="p-1 text-left">{t("recalcPatient")}</th>
                        <th className="p-1 text-left">{t("blockName")}</th>
                        <th className="p-1 text-right">{t("recalcBefore")}</th>
                        <th className="p-1 text-right">{t("recalcAfter")}</th>
                        <th className="p-1 text-right">{t("recalcUsed")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recalcPreview.lines.map((line) => (
                        <tr key={`${line.instanceId}-${line.procedureCode}`} className="border-t border-slate-100">
                          <td className="p-1">{line.patientLabel || line.episodeId}</td>
                          <td className="p-1">{line.procedureName}</td>
                          <td className="p-1 text-right tabular-nums">{line.quotaTotalBefore}</td>
                          <td className="p-1 text-right tabular-nums">{line.quotaTotalAfter}</td>
                          <td className="p-1 text-right tabular-nums">
                            {line.quotaUsed}
                            {line.flooredAtUsed ? (
                              <span className="ml-1 text-amber-800">{t("recalcFloored")}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={recalcBusy}
                  onClick={() => setRecalcPreview(null)}
                >
                  {tc("cancel")}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={
                    recalcBusy ||
                    recalcPreview.openCourseCount === 0 ||
                    recalcPreview.lines.length === 0
                  }
                  onClick={() => void applyRecalc()}
                >
                  {t("recalcApply")}
                </button>
              </div>
            </section>
          ) : null}
        </div>
        <ModalFooter
          onCancel={() => {
            if (!editingId && createStep && createStep > 1) {
              setCreateStep((createStep - 1) as CreateWizardStep);
              return;
            }
            closeBlockModal();
            setCreateStep(null);
            setRecalcPreview(null);
            setOpen(false);
          }}
          cancelLabel={
            !editingId && createStep && createStep > 1 ? t("wizardBack") : tc("cancel")
          }
          onSubmit={() => {
            if (!editingId && createStep === 1) {
              if (!form.code.trim() || !form.name.trim()) {
                showApiError({ error: t("validationRequired") });
                return;
              }
              setCreateStep(2);
              return;
            }
            if (!editingId && createStep === 2) {
              if (!form.quotaMode) {
                showApiError({ error: t("quotaModeRequired") });
                return;
              }
              setCreateStep(3);
              return;
            }
            void save();
          }}
          submitLabel={
            !editingId && createStep && createStep < 3 ? t("wizardNext") : tc("save")
          }
          submitDisabled={saving || blockModalOpen || recalcBusy}
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
            <Field
              label={t("blockName")}
              preset="shortText"
              value={blockDraft.procedureName}
              onChange={(e) =>
                setBlockDraft({ ...blockDraft, procedureName: e.target.value })
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-800">
                <input
                  type="checkbox"
                  checked={blockDraft.showInProcedures}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setBlockDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            showInProcedures: on,
                            procedureOrder: on
                              ? prev.procedureOrder > 0
                                ? prev.procedureOrder
                                : nextProcedureOrder(
                                    blocks.filter((row) => row.procedureCode !== prev.procedureCode),
                                  )
                              : 0,
                          }
                        : prev,
                    );
                  }}
                />
                {t("showInProcedures")}
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={t("procedureOrderDown")}
                  disabled={!blockDraft.showInProcedures || blockDraft.procedureOrder <= 1}
                  onClick={() =>
                    setBlockDraft((prev) =>
                      prev
                        ? { ...prev, procedureOrder: Math.max(1, prev.procedureOrder - 1) }
                        : prev,
                    )
                  }
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="w-6 text-center text-[13px] tabular-nums">
                  {blockDraft.showInProcedures ? blockDraft.procedureOrder : "—"}
                </span>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={t("procedureOrderUp")}
                  disabled={!blockDraft.showInProcedures}
                  onClick={() =>
                    setBlockDraft((prev) =>
                      prev ? { ...prev, procedureOrder: prev.procedureOrder + 1 } : prev,
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
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
            <Field
                label={t("dailyDistinctCap")}
                hint={t("dailyDistinctCapHint")}
                preset="count"
                type="number"
                min={1}
                max={12}
                value={blockDraft.dailyDistinctCap ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  setBlockDraft((prev) =>
                    prev
                      ? { ...prev, dailyDistinctCap: raw ? Number(raw) : null }
                      : prev,
                  );
                }}
              />
            {isDailyRate || (editingId != null && !isDailyRate) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("blockQuotaMode")}
                  value={resolveUiBlockMode(blockDraft)}
                  onChange={(v) => {
                    const next = String(v ?? "") as BlockQuotaMode;
                    setBlockDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            blockQuotaMode: next,
                            quotaPerWeek:
                              next === "WEEKLY"
                                ? Math.max(1, Number(prev.quotaPerWeek) || 1)
                                : prev.quotaPerWeek,
                          }
                        : prev,
                    );
                  }}
                  options={(["DAILY_RATE", "WEEKLY", "PER_STAY"] as const).map((value) => ({
                    value,
                    label: t(`blockQuotaMode_${value}`),
                  }))}
                />
                {resolveUiBlockMode(blockDraft) === "DAILY_RATE" ? (
                  <Field
                    label={t("quotaPerNight")}
                    hint={t("quotaPerNightHint")}
                    preset="count"
                    type="number"
                    min={0.01}
                    max={12}
                    step={0.01}
                    value={blockDraft.quotaPerNight ?? 1}
                    onChange={(e) => {
                      const n = Math.max(0.01, Number(e.target.value) || 0.01);
                      setBlockDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              quotaPerNight: n,
                              dailyUseCap:
                                prev.dailyUseCap == null ||
                                prev.dailyUseCap ===
                                  Math.ceil(Number(prev.quotaPerNight) || 1)
                                  ? Math.max(1, Math.ceil(n))
                                  : prev.dailyUseCap,
                            }
                          : prev,
                      );
                    }}
                  />
                ) : null}
                {resolveUiBlockMode(blockDraft) === "WEEKLY" ? (
                  <Field
                    label={t("quotaPerWeek")}
                    hint={t("quotaPerWeekHint")}
                    preset="count"
                    type="number"
                    min={1}
                    max={21}
                    value={blockDraft.quotaPerWeek ?? 1}
                    onChange={(e) => {
                      const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setBlockDraft((prev) =>
                        prev ? { ...prev, quotaPerWeek: n } : prev,
                      );
                    }}
                  />
                ) : null}
                {resolveUiBlockMode(blockDraft) === "PER_STAY" ? (
                  <Field
                    label={t("stayQty")}
                    preset="count"
                    type="number"
                    min={1}
                    value={blockDraft.quotaTotal ?? 1}
                    onChange={(e) => {
                      const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setBlockDraft((prev) =>
                        prev ? { ...prev, quotaTotal: n } : prev,
                      );
                    }}
                  />
                ) : null}
                {resolveUiBlockMode(blockDraft) === "DAILY_RATE" ? (
                  <Field
                    label={t("dailyUseCap")}
                    hint={t("dailyUseCapHint")}
                    preset="count"
                    type="number"
                    min={1}
                    max={12}
                    value={
                      blockDraft.dailyUseCap ??
                      Math.max(1, Math.ceil(Number(blockDraft.quotaPerNight) || 1))
                    }
                    onChange={(e) => {
                      const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setBlockDraft((prev) =>
                        prev ? { ...prev, dailyUseCap: n } : prev,
                      );
                    }}
                  />
                ) : null}
              </div>
            ) : null}
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
                label={t("fulfillment")}
                value={blockDraft.fulfillment}
                onChange={(v) =>
                  setBlockDraft({
                    ...blockDraft,
                    fulfillment: String(v ?? "") as ProgramBlockFulfillment | "",
                    fulfillmentExplicit: true,
                  })
                }
                options={(["PROCEDURE_ORDER", "LAB_ORDER", "VISIT"] as const).map((value) => ({
                  value,
                  label: t(`fulfillment_${value}`),
                }))}
              />
              {!isDailyRate ? (
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
              ) : null}
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
