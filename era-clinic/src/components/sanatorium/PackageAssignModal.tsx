"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  MODAL_INPUT_CLASS,
  CARD_CONTAINER_CLASS,
  MODAL_FULL_CLASS,
  CatalogField,
  DatePicker,
  showApiError,
} from "@era/satellite-kit/ui";
import { ChevronDown, Info, Minus, Plus, Trash2 } from "lucide-react";
import {
  PhysioSiteChips,
  type PhysioCatalogListItem,
  type PhysioCatalogSite,
  type PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";
import { buildPhysioChipsLabels } from "@/components/physio/physio-chips-labels";
import { inferPhysioTypeGate, siteCodeForNaftalanFill } from "@/domain/physio/physio-type-gate";
import { paramsLabelFromPhysio } from "@/components/physio/physio-params-label";
import { regimeFingerprint } from "@/domain/sanatorium/regime-key";
import { packageAssignBlockText } from "@/lib/package-assign-block";
import {
  formatPackageAssignMissLines,
  toastPackageAssignOutcome,
} from "@/lib/package-assign-toasts";
import {
  isBathTransferQuota,
  isReplaceableQuotaLine,
  bathTransferSku,
  parseTransferQuota,
} from "@/domain/sanatorium/package-assign-quota";
import { StayDayGrid } from "@/components/sanatorium/StayDayGrid";
import type { StayPlan } from "@/domain/sanatorium/package-assign.service";
import { addBakuDays, bakuDateKey, bakuDateDisplay, bakuHourMinute, todayBakuYmd } from "@/lib/baku-day";

export type PackageBalanceRow = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  remaining: number;
  consumed: number;
  inCirculation: number;
  /** PHYSIO_POOL / PARAFFIN_POOL — pick a real SKU, do not assign the pool code. */
  isPool?: boolean;
  /** NAFTALAN_BATH — pick gender SKU when sex unknown. */
  isQuotaAlias?: boolean;
  /** Open SKU picker (pool or unresolved quota alias). */
  needsSkuPicker?: boolean;
  /** False when the block is hidden from the procedure menu. */
  assignable?: boolean;
  fulfillment?: "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";
  procedureOrder?: number;
  isTransfer?: boolean;
  /** Block checkbox. The replace button is hidden when this is false. */
  allowReplace?: boolean;
  transfers?: Array<{ createdAt: string; qty: number; reason: string; fromCode: string }>;
};

export type PackageAssignedAgg = {
  assignBatchId: string | null;
  procedureCode: string;
  procedureName: string;
  qty: number;
  statusKind: "active" | "consumed";
  locked: boolean;
  paramsLabel?: string;
  paramsLines?: string[];
  /** Balance line burned (pool or same as procedureCode). */
  packageQuotaCode?: string | null;
  note?: string;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  regimeKey?: string;
  doneQty?: number;
  movableOrderIds?: string[];
};

type PoolEligibleSku = { code: string; name: string };

type ExtraDraftLine = {
  key: string;
  procedureCode: string;
  procedureName: string;
  qty: number;
  amountNet: number;
  note: string;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  paramsLabel: string;
};

type PackageBlockReason =
  | "NO_PROGRAM"
  | "NO_PROGRAM_CODE"
  | "NO_ANAMNESIS"
  | "NO_COMPLAINT"
  | "NO_DIAGNOSIS"
  | "NO_CARE_TEAM"
  | "TEMPLATE_NOT_FOUND"
  | "PACKAGE_NIGHTS_BELOW_MIN"
  | "INSTANTIATE_FAILED";

type DraftLine = {
  key: string;
  procedureCode: string;
  procedureName: string;
  qty: number;
  note: string;
  bodyPart?: string | null;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  paramsLabel: string;
  fingerprint: string;
  /** When set, Save burns this pool balance instead of procedureCode. */
  burnPoolCode?: string | null;
};

type Props = {
  open: boolean;
  episodeId: string;
  onClose: () => void;
  onSaved: () => void;
  labels: {
    title: string;
    save: string;
    cancel: string;
    leftMenu: string;
    rightAssigned: string;
    remaining: string;
    qty: string;
    note: string;
    addToDraft: string;
    all: string;
    delete: string;
    consumedLocked: string;
    emptyLeft: string;
    emptyRight: string;
    softWarnPrefix: string;
    replace?: string;
    replaceFrom?: string;
    replaceTo?: string;
    replaceSubmit?: string;
    qtyDown?: string;
    qtyUp?: string;
    checkedInLocked?: string;
    pickPoolSku?: string;
  };
};

const EMPTY_PHYSIO: PhysioChipsValue = {
  needsSite: false,
  physioOrderFields: [],
  allowedSiteCodes: [],
  forceSiteTogether: false,
  hideSitePicker: false,
  sitesHintKey: null,
  siteIds: [],
  siteApplyMode: null,
  siteLaterality: {},
  physioFields: {},
  note: null,
};

function fingerprintFromPhysio(p: PhysioChipsValue): string {
  return JSON.stringify({
    note: p.note ?? "",
    siteApplyMode: p.siteApplyMode ?? "",
    physioFields: p.physioFields ?? {},
    siteIds: [...(p.siteIds ?? [])].sort(),
    siteLaterality: p.siteLaterality ?? {},
  });
}

function gateToPhysio(code: string, name: string, note = ""): PhysioChipsValue {
  const gate = inferPhysioTypeGate(code, name);
  return {
    ...EMPTY_PHYSIO,
    needsSite: gate.needsSite,
    physioOrderFields: gate.fields,
    allowedSiteCodes: gate.allowedSiteCodes,
    forceSiteTogether: gate.forceSiteTogether,
    hideSitePicker: gate.hideSitePicker,
    sitesHintKey: gate.sitesHintKey,
    siteApplyMode: gate.forceSiteTogether ? "TOGETHER" : null,
    physioFields: gate.hideSitePicker ? { naftalanFill: "TAM" } : {},
    note: note || null,
  };
}

function extraCutKey(code: string, regimeKey: string): string {
  return `${code}|${regimeKey}`;
}

function assignedKey(row: PackageAssignedAgg): string {
  return `${row.procedureCode}|${row.packageQuotaCode ?? ""}|${row.regimeKey ?? ""}`;
}

function regimeOf(row: {
  siteIds?: string[] | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null> | null;
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  physioFields?: Record<string, unknown> | null;
  regimeKey?: string;
}): string {
  return row.regimeKey || regimeFingerprint(row);
}

function paramLinesOf(label?: string, lines?: string[]): string[] {
  if (lines && lines.length) return lines;
  if (!label?.trim()) return [];
  return label.split(" · ").map((s) => s.trim()).filter(Boolean);
}

function draftMatchesAssigned(
  d: DraftLine,
  row: PackageAssignedAgg,
  rowQuota = row.packageQuotaCode || row.procedureCode,
): boolean {
  const quota = d.burnPoolCode || d.procedureCode;
  return d.procedureCode === row.procedureCode && quota === rowQuota && regimeOf(d) === regimeOf(row);
}

function mergeDraft(prev: DraftLine[], line: Omit<DraftLine, "key">): DraftLine[] {
  const same = prev.find(
    (d) =>
      d.procedureCode === line.procedureCode &&
      (d.burnPoolCode ?? null) === (line.burnPoolCode ?? null) &&
      regimeOf(d) === regimeOf(line),
  );
  if (same) {
    return prev.map((d) =>
      d.key === same.key
        ? {
            ...d,
            qty: d.qty + line.qty,
          }
        : d,
    );
  }
  return [
    ...prev,
    {
      ...line,
      key: `${line.procedureCode}-${Date.now()}`,
    },
  ];
}
export function PackageAssignModal({
  open,
  episodeId,
  onClose,
  onSaved,
  labels,
}: Props) {
  const locale = useLocale();
  const tPhysio = useTranslations("patientCard");
  const tc = useTranslations("common");
  const physioLabels = useMemo(() => buildPhysioChipsLabels(tPhysio), [tPhysio]);
  const cancelLabel =
    labels.cancel && !labels.cancel.includes(".") ? labels.cancel : tc("cancel");
  const [balances, setBalances] = useState<PackageBalanceRow[]>([]);
  const [assigned, setAssigned] = useState<PackageAssignedAgg[]>([]);
  const [poolEligible, setPoolEligible] = useState<Record<string, PoolEligibleSku[]>>({});
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [formCode, setFormCode] = useState<string | null>(null);
  const [formBurnPool, setFormBurnPool] = useState<string | null>(null);
  const [formQty, setFormQty] = useState(1);
  const [formPhysio, setFormPhysio] = useState<PhysioChipsValue>(EMPTY_PHYSIO);
  const [sexBlockedCodes, setSexBlockedCodes] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("9");
  const [softWarn, setSoftWarn] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<PackageBlockReason | null>(null);
  const [formLane, setFormLane] = useState<"package" | "extra" | null>(null);
  const [extraDraft, setExtraDraft] = useState<ExtraDraftLine[]>([]);
  /** Unpaid sessions marked for removal. Saxla drops them from the latest day backward. */
  const [extraPendingCut, setExtraPendingCut] = useState<Record<string, number>>({});
  const [extraPrices, setExtraPrices] = useState<Record<string, number>>({});
  const [extraPending, setExtraPending] = useState<
    Array<{
      id: string;
      procedureCode: string;
      procedureName: string;
      amountNet: number;
      kind?: "procedure" | "lab" | "visit";
      regimeKey?: string;
      scheduledAt?: string;
      physioFields?: Record<string, unknown> | null;
      siteIds?: string[];
      siteApplyMode?: "TURN" | "TOGETHER" | null;
      siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
    }>
  >([]);
  const [paidExtras, setPaidExtras] = useState<
    Array<{
      id: string;
      procedureCode: string;
      procedureName: string;
      amountNet: number;
      regimeKey?: string;
    }>
  >([]);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [catalogQuery, setCatalogQuery] = useState("");

  const [catalog, setCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [allCodes, setAllCodes] = useState<
    Array<{ value: string; label: string; departmentName: string }>
  >([]);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [transferInfoCode, setTransferInfoCode] = useState<string | null>(null);
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [replaceQty, setReplaceQty] = useState(1);
  const [replaceBatchId, setReplaceBatchId] = useState<string | null>(null);
  const [replaceReason, setReplaceReason] = useState("");
  const [packagePin, setPackagePin] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [checkoutAsk, setCheckoutAsk] = useState<{
    names: string[];
    package: boolean;
    extras: boolean;
  } | null>(null);
  const [stayPlan, setStayPlan] = useState<StayPlan>({ days: [], checkoutYmd: null, closedDays: [], marks: [] });
  const [planFocus, setPlanFocus] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Set<string>>(new Set());
  const [pendingCut, setPendingCut] = useState<Record<string, number>>({});
  const [masseurOptions, setMasseurOptions] = useState<Record<string, Array<{ id: string; fullName: string }>>>({});
  const [masseurByCode, setMasseurByCode] = useState<Record<string, string>>({});
  const [masseurSaved, setMasseurSaved] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/sanatorium/episodes/${episodeId}/package-assign?locale=${encodeURIComponent(locale)}`,
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof d?.code === "string" ? d.code : null;
      const msg =
        code === "NO_PROGRAM_CODE"
          ? tPhysio("packageAssignNoProgramCode")
          : code === "NO_PROGRAM"
            ? tPhysio("packageAssignNoProgram")
            : typeof d?.error === "string" && d.error.trim()
              ? d.error
              : tPhysio("packageAssignLoadFailed");
      setBlockReason(
        code === "NO_PROGRAM" || code === "NO_PROGRAM_CODE" ? code : null,
      );
      const text = code && !msg.includes(code) ? `${msg} (${code})` : msg;
      setError(text);
      showApiError({ error: text });
      return;
    }
    const payload = d.data ?? d;
    setBalances(payload.balances ?? []);
    setAssigned(payload.assigned ?? []);
    setStayPlan(
      payload.stayPlan ?? { days: [], checkoutYmd: null, closedDays: [], marks: [] },
    );
    const optionRows =
      payload.masseurOptions && typeof payload.masseurOptions === "object"
        ? (payload.masseurOptions as Record<string, Array<{ id: string; fullName: string }>>)
        : {};
    setMasseurOptions(optionRows);
    const savedPick: Record<string, string> = {};
    const byCode =
      payload.masseurByCode && typeof payload.masseurByCode === "object"
        ? (payload.masseurByCode as Record<string, string | null>)
        : {};
    for (const code of Object.keys(byCode)) {
      savedPick[code] = typeof byCode[code] === "string" ? byCode[code] : "";
    }
    setMasseurSaved(savedPick);
    setMasseurByCode(savedPick);
    setPoolEligible(payload.poolEligible ?? {});
    setSexBlockedCodes(
      new Set(
        Array.isArray(payload.sexBlockedCodes)
          ? payload.sexBlockedCodes.filter((row: unknown): row is string => typeof row === "string")
          : [],
      ),
    );
    const code = typeof payload.packageCode === "string" ? payload.packageCode : null;
    const ver =
      typeof payload.packageVersion === "number" ? payload.packageVersion : null;
    setPackagePin(code ? (ver != null ? `${code} · v${ver}` : code) : null);
    const known: PackageBlockReason[] = [
      "NO_PROGRAM",
      "NO_PROGRAM_CODE",
      "NO_ANAMNESIS",
      "NO_COMPLAINT",
      "NO_DIAGNOSIS",
      "NO_CARE_TEAM",
      "TEMPLATE_NOT_FOUND",
      "PACKAGE_NIGHTS_BELOW_MIN",
      "INSTANTIATE_FAILED",
    ];
    const block = known.includes(payload.blockReason) ? payload.blockReason : null;
    setBlockReason(block);
    const blockText = packageAssignBlockText(
      tPhysio,
      block,
      typeof payload.packageCode === "string" ? payload.packageCode : "",
      {
        nights:
          typeof payload.blockNights === "number" ? payload.blockNights : null,
        minNights:
          typeof payload.blockMinNights === "number" ? payload.blockMinNights : null,
        message: typeof payload.blockMessage === "string" ? payload.blockMessage : null,
      },
    );
    if (blockText) {
      setError(blockText);
      showApiError({ error: blockText });
    }
    else if (payload.softWarnDay1) setSoftWarn(String(payload.softWarnDay1));
  }, [episodeId, locale, tPhysio]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  useEffect(() => {
    if (!open) return;
    setDraft([]);
    setExtraDraft([]);
    setFormLane(null);
    setPendingCancel(new Set());
    setPendingCut({});
    setMasseurByCode({});
    setMasseurSaved({});
    setMasseurOptions({});
    setFormCode(null);
    setFormBurnPool(null);
    setError(null);
    setSoftWarn(null);
    setBlockReason(null);
    setPackagePin(null);
    setReplaceOpen(false);
    void (async () => {
      await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseUnseated: true, lines: [] }),
      }).catch(() => undefined);
      await loadRef.current();
    })();
    void (async () => {
      try {
        const [catRes, typesRes, extraRes] = await Promise.all([
          fetch("/api/physio-catalog"),
          fetch(`/api/procedure-types?locale=${encodeURIComponent(localeRef.current)}`),
          fetch(`/api/sanatorium/episodes/${episodeId}/extras-prescribe`),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          setCatalog((data.sites ?? data.data?.sites ?? []) as PhysioCatalogSite[]);
          setPrograms((data.programs ?? data.data?.programs ?? []) as PhysioCatalogListItem[]);
          setSubstances(
            (data.substances ?? data.data?.substances ?? []) as PhysioCatalogListItem[],
          );
        }
        if (extraRes.ok) {
          const data = await extraRes.json();
          const payload = data.data ?? data;
          setExtraPrices(payload.prices ?? {});
          const pending = (Array.isArray(payload.items) ? payload.items : []).filter(
            (row: { kind?: string }) => row.kind !== "lab",
          );
          setExtraPendingCut({});
          setExtraPending(
            pending.map(
              (row: {
                id: string;
                procedureCode?: string;
                procedureName?: string;
                amountNet?: number;
                kind?: "procedure" | "lab" | "visit";
                regimeKey?: string;
                scheduledAt?: string;
                physioFields?: Record<string, unknown> | null;
                siteIds?: string[];
                siteApplyMode?: "TURN" | "TOGETHER" | null;
                siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
              }) => ({
                id: row.id,
                procedureCode: row.procedureCode || "",
                procedureName: row.procedureName || row.id,
                amountNet: Number(row.amountNet || 0),
                kind: row.kind === "lab" || row.kind === "visit" ? row.kind : "procedure",
                regimeKey: row.regimeKey ?? "",
                scheduledAt: row.scheduledAt,
                physioFields: row.physioFields ?? null,
                siteIds: row.siteIds,
                siteApplyMode: row.siteApplyMode ?? null,
                siteLaterality: row.siteLaterality,
              }),
            ),
          );
          const paid = Array.isArray(payload.paid) ? payload.paid : [];
          setPaidExtras(
            paid.map(
              (row: {
                id: string;
                procedureCode?: string;
                procedureName?: string;
                amountNet?: number;
                regimeKey?: string;
              }) => ({
                id: row.id,
                procedureCode: row.procedureCode || "",
                procedureName: row.procedureName || row.id,
                amountNet: Number(row.amountNet || 0),
                regimeKey: row.regimeKey ?? "",
              }),
            ),
          );
        }
        if (typesRes.ok) {
          const data = await typesRes.json();
          const rows = (data.data ?? data.items ?? data) as Array<{
            code: string;
            name: string;
            departmentName?: string;
          }>;
          if (Array.isArray(rows)) {
            setAllCodes(
              rows.map((r) => ({
                value: r.code,
                label: r.name || r.code,
                departmentName:
                  "departmentName" in r && typeof r.departmentName === "string"
                    ? r.departmentName
                    : "",
              })),
            );
          }
        }
      } catch {
        /* optional catalogs */
      }
    })();
  }, [open, episodeId]);

  const formName = useMemo(() => {
    if (!formCode) {
      if (formBurnPool) {
        return (
          balances.find((b) => b.procedureCode === formBurnPool)?.procedureName ??
          formBurnPool
        );
      }
      return "";
    }
    const fromPool = formBurnPool
      ? poolEligible[formBurnPool]?.find((s) => s.code === formCode)?.name
      : null;
    if (fromPool) return fromPool;
    return (
      balances.find((b) => b.procedureCode === formCode)?.procedureName ??
      allCodes.find((c) => c.value === formCode)?.label ??
      formCode
    );
  }, [formCode, formBurnPool, balances, poolEligible, allCodes]);

  const formFulfillment = useMemo(() => {
    const quota = formBurnPool || formCode;
    if (!quota) return "PROCEDURE_ORDER" as const;
    return (
      balances.find((b) => b.procedureCode === quota)?.fulfillment ?? "PROCEDURE_ORDER"
    );
  }, [formBurnPool, formCode, balances]);
  const formIsStudy = formFulfillment === "LAB_ORDER" || formFulfillment === "VISIT";

  function menuQuotaForAssigned(row: PackageAssignedAgg): string {
    const stamped = row.packageQuotaCode || row.procedureCode;
    if (balances.some((b) => b.procedureCode === stamped)) return stamped;
    const menuCodes = new Set(balances.map((b) => b.procedureCode));
    for (const [pool, skus] of Object.entries(poolEligible)) {
      if (!menuCodes.has(pool)) continue;
      if (skus.some((sku) => sku.code === row.procedureCode)) return pool;
    }
    return stamped;
  }

  function lineIsStudy(line: DraftLine): boolean {
    const quota = line.burnPoolCode || line.procedureCode;
    const fulfillment =
      balances.find((b) => b.procedureCode === quota)?.fulfillment ?? "PROCEDURE_ORDER";
    return fulfillment === "LAB_ORDER" || fulfillment === "VISIT";
  }

  const draftRemaining = useMemo(() => {
    const map = new Map(balances.map((b) => [b.procedureCode, b.remaining]));
    for (const d of draft) {
      const quota = d.burnPoolCode || d.procedureCode;
      map.set(quota, Math.max(0, (map.get(quota) ?? 0) - d.qty));
    }
    for (const row of assigned) {
      if (row.locked) continue;
      const key = assignedKey(row);
      const quota = menuQuotaForAssigned(row);
      const cut = pendingCancel.has(key)
        ? (row.movableOrderIds?.length ?? Math.max(0, row.qty - (row.doneQty ?? 0)))
        : pendingCut[key] ?? 0;
      if (cut > 0) map.set(quota, (map.get(quota) ?? 0) + cut);
    }
    return map;
  }, [balances, poolEligible, draft, assigned, pendingCancel, pendingCut]);

  const hasPendingAdjust =
    pendingCancel.size > 0 || Object.values(pendingCut).some((n) => n > 0);
  const clinicalLock =
    blockReason === "NO_ANAMNESIS" ||
    blockReason === "NO_COMPLAINT" ||
    blockReason === "NO_DIAGNOSIS" ||
    blockReason === "NO_CARE_TEAM";
  const extraDraftTotal = extraDraft.reduce((sum, row) => sum + row.amountNet * row.qty, 0);
  const extraPendingTotal = extraPending.reduce((sum, row) => {
    const stored = row.amountNet > 0 ? row.amountNet : unitOf(row.procedureCode);
    return sum + stored;
  }, 0) - Object.entries(extraPendingCut).reduce((sum, [key, qty]) => {
    if (qty < 1) return sum;
    const sample = extraPending.find((row) => extraCutKey(row.procedureCode, row.regimeKey ?? "") === key);
    const unit = sample && sample.amountNet > 0 ? sample.amountNet : unitOf(sample?.procedureCode || key);
    return sum + unit * qty;
  }, 0);
  const masseurDirty = Object.keys({ ...masseurByCode, ...masseurSaved }).some((code) => {
    if (!masseurOptions[code]?.length) return false;
    return (masseurByCode[code] ?? "") !== (masseurSaved[code] ?? "");
  });
  const canSavePackage =
    !blockReason &&
    (draft.length > 0 ||
      hasPendingAdjust ||
      masseurDirty ||
      (formLane === "package" && Boolean(formCode)));
  const extraCutCount = Object.values(extraPendingCut).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  const canSaveExtras =
    !clinicalLock && (extraDraft.length > 0 || extraCutCount > 0 || formLane === "extra");
  const canSave = !busy && (canSavePackage || canSaveExtras);
  const unsaved =
    canSavePackage ||
    canSaveExtras ||
    replaceFrom !== "" ||
    replaceTo !== "" ||
    replaceReason.trim() !== "";
  function requestClose() {
    if (busy) return;
    if (unsaved) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  const leftoverDraft = useMemo(() => {
    const used = new Set<string>();
    for (const row of assigned) {
      const key = assignedKey(row);
      if (pendingCancel.has(key)) continue;
      const match = draft.find(
        (d) => !used.has(d.key) && draftMatchesAssigned(d, row, menuQuotaForAssigned(row)),
      );
      if (match) used.add(match.key);
    }
    return draft.filter((d) => !used.has(d.key));
  }, [assigned, draft, pendingCancel, balances, poolEligible]);

  /** Modal add order → Saxla seats №1 first within a daily-cap block. */
  const saxlaOrderByDraftKey = useMemo(() => {
    const map = new Map<string, number>();
    draft.forEach((line, index) => map.set(line.key, index + 1));
    return map;
  }, [draft]);

  const bathFromOptions = useMemo(
    () =>
      balances
        .filter(
          (b) =>
            b.assignable !== false &&
            !b.isTransfer &&
            b.allowReplace === true,
        )
        .map((b) => ({
          value: b.procedureCode,
          label: `${b.procedureName} (${b.remaining}/${b.quotaTotal})`,
        })),
    [balances],
  );

  const transferBalances = useMemo(
    () =>
      balances.filter(
        (b) => b.isTransfer || isBathTransferQuota(b.procedureCode),
      ),
    [balances],
  );

  const menuBalances = useMemo(
    () =>
      balances.filter(
        (b) =>
          b.assignable !== false &&
          b.fulfillment !== "LAB_ORDER" &&
          b.fulfillment !== "VISIT" &&
          !b.isTransfer &&
          !isBathTransferQuota(b.procedureCode),
      ),
    [balances],
  );

  const replaceToOptions = useMemo(() => {
    return allCodes.filter((row) => !isReplaceableQuotaLine(row.value, row.label));
  }, [allCodes]);

  const poolSkuOptions = useMemo(() => {
    if (!formBurnPool) return [];
    return (poolEligible[formBurnPool] ?? []).map((s) => ({
      value: s.code,
      label: s.name || s.code,
    }));
  }, [formBurnPool, poolEligible]);

  const formQuotaCode = formBurnPool || formCode;

  function needsPicker(bal: PackageBalanceRow | undefined): boolean {
    if (!bal) return false;
    // Do not force picker for quota aliases when sex already resolved (needsSkuPicker=false).
    return Boolean(bal.isPool || bal.needsSkuPicker);
  }

  function closeForm() {
    setFormLane(null);
    setFormCode(null);
    setFormBurnPool(null);
    setFormPhysio(EMPTY_PHYSIO);
  }

  const extraGroups = useMemo(() => {
    const map = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of allCodes) {
      const key = row.departmentName.trim() || tPhysio("departmentOther");
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [allCodes, locale, tPhysio]);

  function openForm(code: string, fillAllQty = false) {
    setFormLane("package");
    const bal = balances.find((b) => b.procedureCode === code);
    const rem = draftRemaining.get(code) ?? bal?.remaining ?? 0;
    if (bal?.isTransfer || isBathTransferQuota(code)) {
      const sku = bathTransferSku(code);
      if (refuseWrongSex(sku)) return;
      setFormBurnPool(code);
      setFormCode(sku);
      setFormQty(fillAllQty ? Math.max(1, rem) : Math.min(1, Math.max(1, rem)) || 1);
      setFormPhysio(gateToPhysio(sku, bal?.procedureName ?? sku));
      return;
    }
    if (refuseWrongSex(code)) return;
    if (needsPicker(bal)) {
      setFormBurnPool(code);
      // Auto-select when only one eligible SKU (sex-filtered alias or single-member block).
      const eligible = poolEligible[code] ?? [];
      const auto = eligible.length === 1 ? eligible[0].code : null;
      setFormCode(auto);
      setFormQty(fillAllQty ? Math.max(1, rem) : Math.min(1, Math.max(1, rem)) || 1);
      setFormPhysio(auto ? gateToPhysio(auto, eligible[0]?.name ?? auto) : EMPTY_PHYSIO);
      return;
    }
    // Resolved alias (known sex): burn balance code, assign concrete SKU.
    if (bal?.isQuotaAlias) {
      const eligible = poolEligible[code] ?? [];
      const sku = eligible[0];
      if (sku) {
        setFormBurnPool(code);
        setFormCode(sku.code);
        setFormQty(fillAllQty ? Math.max(1, rem) : Math.min(1, Math.max(1, rem)) || 1);
        setFormPhysio(gateToPhysio(sku.code, sku.name));
        return;
      }
    }
    const name = bal?.procedureName ?? code;
    setFormBurnPool(null);
    setFormCode(code);
    setFormQty(
      fillAllQty ? Math.max(1, rem) : Math.min(1, Math.max(1, rem)) || 1,
    );
    setFormPhysio(gateToPhysio(code, name));
  }

  function selectPoolSku(skuCode: string) {
    if (!formBurnPool || !skuCode) return;
    const name =
      poolEligible[formBurnPool]?.find((s) => s.code === skuCode)?.name ?? skuCode;
    setFormCode(skuCode);
    setFormPhysio(gateToPhysio(skuCode, name));
  }

  function pushDraft(line: Omit<DraftLine, "key">) {
    setDraft((prev) => mergeDraft(prev, line));
  }

  function openTransferForSku(code: string): string | null {
    const hit = balances.find((row) => {
      const parsed = parseTransferQuota(row.procedureCode);
      return parsed?.sku === code && (draftRemaining.get(row.procedureCode) ?? row.remaining) > 0;
    });
    return hit?.procedureCode ?? null;
  }

  function quotaForCode(code: string): { rem: number; burnPool: string | null } {
    const xfer = openTransferForSku(code);
    const xferRem = xfer ? (draftRemaining.get(xfer) ?? 0) : 0;
    if (xfer && xferRem > 0) {
      return { rem: xferRem, burnPool: xfer };
    }
    if (balances.some((b) => b.procedureCode === code && !b.isPool && !b.isQuotaAlias)) {
      return { rem: draftRemaining.get(code) ?? 0, burnPool: null };
    }
    const menuCodes = new Set(balances.map((row) => row.procedureCode));
    for (const [pool, skus] of Object.entries(poolEligible)) {
      if (!menuCodes.has(pool)) continue;
      if (skus.some((sku) => sku.code === code)) {
        return { rem: draftRemaining.get(pool) ?? 0, burnPool: pool };
      }
    }
    return { rem: draftRemaining.get(code) ?? 0, burnPool: null };
  }

  function formDetail() {
    const fill = formPhysio.physioFields?.naftalanFill;
    const fillCode =
      fill === "OTURAQ" || fill === "QURSAQ" || fill === "TAM" ? fill : "TAM";
    const siteIds =
      formPhysio.hideSitePicker && formPhysio.siteIds.length === 0
        ? (() => {
            const row = catalog.find((s) => s.code === siteCodeForNaftalanFill(fillCode));
            return row ? [row.id] : [];
          })()
        : formPhysio.siteIds;
    return {
      note: formPhysio.note ?? "",
      physioFields: {
        ...formPhysio.physioFields,
        ...(formQty <= 1 ? { bathSequence: null } : {}),
      } as Record<string, unknown>,
      siteIds,
      siteApplyMode: (formPhysio.hideSitePicker
        ? "TOGETHER"
        : formPhysio.siteApplyMode) as "TURN" | "TOGETHER" | null,
      siteLaterality: formPhysio.siteLaterality,
      paramsLabel: paramsLabelFromPhysio({ ...formPhysio, siteIds }, catalog, locale, { programs, substances }),
    };
  }

  function formDraftLine(): Omit<DraftLine, "key"> | null {
    if (!formCode || !formQuotaCode) return null;
    const quota = formBurnPool
      ? { rem: draftRemaining.get(formBurnPool) ?? 0, burnPool: formBurnPool }
      : quotaForCode(formCode);
    const cap = formFulfillment === "LAB_ORDER" ? 1 : formQty;
    const qty = Math.min(formQty, quota.rem, cap);
    if (qty < 1) return null;
    const detail = formDetail();
    return {
      procedureCode: formCode,
      procedureName: formName,
      qty,
      ...detail,
      fingerprint: fingerprintFromPhysio(formPhysio),
      burnPoolCode: quota.burnPool,
    };
  }

  function addExtraFromForm() {
    if (!formCode) return;
    const unit = unitOf(formCode);
    const fill = formPhysio.physioFields?.naftalanFill;
    const fillCode =
      fill === "OTURAQ" || fill === "QURSAQ" || fill === "TAM" ? fill : "TAM";
    const occupancy =
      formPhysio.hideSitePicker && formPhysio.siteIds.length === 0
        ? (() => {
            const row = catalog.find((s) => s.code === siteCodeForNaftalanFill(fillCode));
            return row ? [row.id] : [];
          })()
        : formPhysio.siteIds;
    const qty = Math.max(1, formQty);
    setExtraDraft((prev) => [
      ...prev,
      {
        key: `${formCode}-${Date.now()}`,
        procedureCode: formCode,
        procedureName: formName,
        qty,
        amountNet: unit,
        note: formPhysio.note ?? "",
        physioFields: {
          ...formPhysio.physioFields,
          ...(qty <= 1 ? { bathSequence: null } : {}),
        } as Record<string, unknown>,
        siteIds: occupancy,
        siteApplyMode: formPhysio.hideSitePicker ? "TOGETHER" : formPhysio.siteApplyMode,
        siteLaterality: formPhysio.siteLaterality,
        paramsLabel: paramsLabelFromPhysio({ ...formPhysio, siteIds: occupancy }, catalog, locale, { programs, substances }),
      },
    ]);
    closeForm();
  }

  function pushPaid(
    code: string,
    name: string,
    qty: number,
    extra?: Partial<Omit<ExtraDraftLine, "key" | "procedureCode" | "procedureName" | "qty" | "amountNet">>,
  ) {
    if (qty < 1) return;
    const unit = unitOf(code);
    const paramsLabel = extra?.paramsLabel ?? "";
    const regimeKey = regimeOf(extra ?? {});
    setExtraDraft((prev) => {
      const hit = prev.find((row) => row.procedureCode === code && regimeOf(row) === regimeKey);
      if (hit) {
        return prev.map((row) => (row.key === hit.key ? { ...row, qty: row.qty + qty } : row));
      }
      return [
        ...prev,
        {
          key: `${code}-paid-${regimeKey || "plain"}`,
          procedureCode: code,
          procedureName: name,
          qty,
          amountNet: unit,
          note: extra?.note ?? "",
          physioFields: extra?.physioFields ?? null,
          siteIds: extra?.siteIds ?? [],
          siteApplyMode: extra?.siteApplyMode ?? null,
          siteLaterality: extra?.siteLaterality,
          paramsLabel,
        },
      ];
    });
  }

  function refuseWrongSex(code: string): boolean {
    if (!sexBlockedCodes.has(code)) return false;
    showApiError({ error: tPhysio("packageAssignMissCabinSex") });
    return true;
  }

  function openCatalogLine(code: string, name: string) {
    if (refuseWrongSex(code)) return;
    const xfer = openTransferForSku(code);
    if (xfer && (draftRemaining.get(xfer) ?? 0) > 0) {
      openForm(xfer);
      return;
    }
    setFormLane("package");
    setFormBurnPool(null);
    setFormCode(code);
    setFormQty(1);
    setFormPhysio(gateToPhysio(code, name));
  }

  function addDraft() {
    if (formCode && refuseWrongSex(formCode)) return;
    if (formLane === "extra") {
      addExtraFromForm();
      return;
    }
    const line = formDraftLine();
    const quota = formCode
      ? formBurnPool
        ? { rem: draftRemaining.get(formBurnPool) ?? 0, burnPool: formBurnPool }
        : quotaForCode(formCode)
      : { rem: 0, burnPool: null };
    const inPackageQty = formCode
      ? Math.min(formQty, quota.rem, formFulfillment === "LAB_ORDER" ? 1 : formQty)
      : 0;
    const paid = formCode ? Math.max(0, formQty - inPackageQty) : 0;
    if (line) pushDraft(line);
    if (paid > 0 && formCode) pushPaid(formCode, formName, paid, formDetail());
    if (line || paid > 0) closeForm();
  }

  function fillAll(code: string) {
    if (refuseWrongSex(code)) return;
    const bal = balances.find((b) => b.procedureCode === code);
    if (needsPicker(bal)) {
      openForm(code, true);
      return;
    }
    const rem = draftRemaining.get(code) ?? bal?.remaining ?? 0;
    if (rem < 1) return;
    // Resolved quota alias (known sex): burn pool code + concrete SKU.
    if (bal?.isQuotaAlias) {
      const eligible = poolEligible[code] ?? [];
      const sku = eligible[0];
      if (!sku) {
        openForm(code, true);
        return;
      }
      if (refuseWrongSex(sku.code)) return;
      const physio = gateToPhysio(sku.code, sku.name);
      pushDraft({
        procedureCode: sku.code,
        procedureName: sku.name,
        qty: rem,
        note: "",
        physioFields: {},
        siteIds: [],
        siteApplyMode: null,
        paramsLabel: "",
        fingerprint: fingerprintFromPhysio(physio),
        burnPoolCode: code,
      });
      return;
    }
    const name = bal?.procedureName ?? code;
    const physio = gateToPhysio(code, name);
    pushDraft({
      procedureCode: code,
      procedureName: name,
      qty: rem,
      note: "",
      physioFields: {},
      siteIds: [],
      siteApplyMode: null,
      paramsLabel: "",
      fingerprint: fingerprintFromPhysio(physio),
    });
  }

  function bathFields(
    _code: string,
    fields: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    return fields ?? null;
  }

  function defaultStartPoint(): { date: string; hour: string } {
    const { hour } = bakuHourMinute(new Date());
    // End of the current hour, then one more hour. 11:22 → 13:00.
    let next = hour + 2;
    let date = todayBakuYmd();
    if (next >= 17) {
      next = 9;
      date = addBakuDays(date, 1);
    }
    if (next < 9) next = 9;
    return { date, hour: String(next) };
  }

  function noonMissNames(rows: Array<{ reason?: string; procedureName?: string; procedureCode?: string }>): string[] {
    return rows
      .filter((row) => row.reason === "no_slot" || row.reason === "no_day")
      .map((row) => row.procedureName || row.procedureCode)
      .filter((name): name is string => Boolean(name))
      .filter((name, index, all) => all.indexOf(name) === index);
  }

  function placeMissText(
    misses: Array<{ ymd?: string; reason?: string; procedureName?: string; procedureCode?: string }> | undefined,
  ): string {
    return formatPackageAssignMissLines(misses, tPhysio);
  }

  function replaceReasonToast(): string {
    const name =
      balances.find((row) => row.procedureCode === replaceFrom)?.procedureName ??
      replaceFrom;
    return tPhysio("replaceBathsNeedReason", { name: name || "—" });
  }

  function assignSaveMessage(payload: {
    code?: unknown;
    error?: unknown;
    misses?: Array<{ ymd?: string; reason?: string }>;
  }): string {
    const code = typeof payload.code === "string" ? payload.code : null;
    const serverError = typeof payload.error === "string" ? payload.error.trim() : "";
    const misses = placeMissText(payload.misses);
    if (misses) return misses;
    if (code === "CABIN_SEX") return tPhysio("packageAssignMissCabinSex");
    if (code === "MASSEUR_NOT_SKILLED") return tPhysio("masseurNotSkilled");
    if (code === "NO_CABIN") return tPhysio("packageAssignNoCabin", { names: serverError });
    if (code === "PLACE_FAILED") return serverError || tPhysio("packageAssignPlaceFailed");
    if (code === "NOT_IN_PROCEDURES") return tPhysio("packageAssignNotInProcedures");
    if (code === "NO_SERVICE") return tPhysio("packageAssignNoService");
    if (code === "NO_CARE_TEAM") return tPhysio("packageAssignNoCareTeam");
    if (code === "LAB_ALREADY_OPEN") return tPhysio("packageAssignLabOpen");
    if (code === "LAB_UNPAID_EXISTS") return tPhysio("labUnpaidCheque");
    if (code === "LAB_ONE") return tPhysio("packageAssignLabOne");
    if (code === "REASON_REQUIRED") return replaceReasonToast();
    if (serverError) return code && code !== "PLACE_FAILED" && !serverError.includes(code)
      ? `${serverError} (${code})`
      : serverError;
    return tc("saveFailed");
  }

  function masseurPrefs(): Array<{ procedureCode: string; practitionerId: string | null }> {
    const codes = new Set([...Object.keys(masseurByCode), ...Object.keys(masseurSaved)]);
    const prefs: Array<{ procedureCode: string; practitionerId: string | null }> = [];
    for (const code of codes) {
      if (!masseurOptions[code]?.length) continue;
      const next = masseurByCode[code] ?? "";
      const prev = masseurSaved[code] ?? "";
      if (next === prev) continue;
      prefs.push({ procedureCode: code, practitionerId: next || null });
    }
    return prefs;
  }

  function masseurIdFor(code: string): string | null {
    if (!masseurOptions[code]?.length) return null;
    return masseurByCode[code] || null;
  }

  async function save(start?: { date: string; hour: string }) {
    let extras = extraDraft;
    let lines = draft;
    if (formLane === "extra" && formCode) {
      const unit = unitOf(formCode);
      extras = [
        ...extras,
        {
          key: `${formCode}-flush`,
          procedureCode: formCode,
          procedureName: formName,
          qty: Math.max(1, formQty),
          amountNet: unit,
          note: formPhysio.note ?? "",
          physioFields: formPhysio.physioFields ?? null,
          siteIds: formPhysio.siteIds,
          siteApplyMode: formPhysio.siteApplyMode,
          siteLaterality: formPhysio.siteLaterality,
          paramsLabel: paramsLabelFromPhysio(formPhysio, catalog, locale, { programs, substances }),
        },
      ];
    } else {
      const flushed = formDraftLine();
      lines = flushed ? mergeDraft(draft, flushed) : draft;
      const quota = formCode
        ? formBurnPool
          ? { rem: draftRemaining.get(formBurnPool) ?? 0 }
          : quotaForCode(formCode)
        : { rem: 0 };
      const inPackageQty = formCode
        ? Math.min(formQty, quota.rem, formFulfillment === "LAB_ORDER" ? 1 : formQty)
        : 0;
      const paid = formCode ? Math.max(0, formQty - inPackageQty) : 0;
      if (paid > 0 && formCode) {
        const detail = formDetail();
        const unit = unitOf(formCode);
        extras = [
          ...extras,
          {
            key: `${formCode}-paid-flush`,
            procedureCode: formCode,
            procedureName: formName,
            qty: paid,
            amountNet: unit,
            ...detail,
          },
        ];
      }
    }
    const cancelKeys = pendingCancel;
    const cuts = pendingCut;
    const hasAdjust =
      cancelKeys.size > 0 || Object.values(cuts).some((n) => n > 0);
    const prefs = masseurPrefs();
    const extraRemovals = Object.entries(extraPendingCut)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const matches = extraPending
          .filter((row) => extraCutKey(row.procedureCode, row.regimeKey ?? "") === key)
          .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
        const sample = matches[0];
        return {
          procedureCode: sample?.procedureCode || key.split("|")[0] || key,
          qty,
          kind: sample?.kind ?? "procedure",
          orderIds: (sample?.kind === "lab" || sample?.kind === "visit") ? undefined : matches.slice(0, qty).map((row) => row.id),
        };
      });
    if (lines.length === 0 && !hasAdjust && extras.length === 0 && extraRemovals.length === 0 && prefs.length === 0) {
      if (replaceFrom !== "" || replaceTo !== "" || replaceReason.trim() !== "") {
        await submitReplace();
        return;
      }
      onClose();
      return;
    }
    const needsSlot = lines.some((line) => !lineIsStudy(line));
    if (lines.length > 0 && needsSlot && !blockReason && !start && assigned.length === 0) {
      const point = defaultStartPoint();
      setStartDate(point.date);
      setStartHour(point.hour);
      setStartOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    let pendingCheckout: { names: string[]; package: boolean; extras: boolean } | null = null;
    try {
      for (const row of assigned) {
        if (row.locked) continue;
        const key = assignedKey(row);
        const cut = cuts[key] ?? 0;
        const cancelAll = cancelKeys.has(key) || cut >= row.qty;
        if (!cancelAll && cut < 1) continue;
        const movable = row.movableOrderIds ?? [];
        const drop = cancelAll || cut >= movable.length ? movable : movable.slice(0, cut);
        if (drop.length === 0) continue;
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/package-assign/adjust`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              procedureCode: row.procedureCode,
              cancelOrderIds: drop,
            }),
          },
        );
        if (!res.ok) {
          const d = await res.json();
          showApiError({ error: assignSaveMessage(d) }, tc("failed"));
          return;
        }
      }

      if ((lines.length > 0 || prefs.length > 0) && !blockReason) {
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: lines.map((d) => ({
              procedureCode: d.procedureCode,
              qty: d.qty,
              note: d.note || null,
              physioFields: bathFields(d.procedureCode, d.physioFields),
              siteIds: d.siteIds ?? [],
              siteApplyMode: d.siteApplyMode ?? null,
              siteLaterality: d.siteLaterality ?? {},
              burnPoolCode: d.burnPoolCode ?? null,
              preferredPractitionerId: masseurIdFor(d.procedureCode),
            })),
            ...(prefs.length > 0 ? { staffPrefs: prefs } : {}),
            ...(start ? { startOn: start.date, startHour: Number(start.hour) } : {}),
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          showApiError({ error: assignSaveMessage(d) }, tc("saveFailed"));
          return;
        }
        const payload = d.data ?? d;
        const missRows = Array.isArray(payload.misses) ? payload.misses : [];
        const noonNames = noonMissNames(missRows);
        if (noonNames.length > 0) {
          pendingCheckout = { names: noonNames, package: true, extras: false };
        } else {
          toastPackageAssignOutcome(
            lines.map((row) => ({
              procedureCode: row.procedureCode,
              procedureName: row.procedureName,
              qty: row.qty,
            })),
            payload.misses,
            (key, values) => tPhysio(key, values),
          );
        }
        if (payload.softWarn) setSoftWarn(String(payload.softWarn));
      }
      if ((extras.length > 0 || extraRemovals.length > 0) && !clinicalLock) {
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/extras-prescribe`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines: extras.map((row) => ({
                procedureCode: row.procedureCode,
                qty: row.qty,
                note: row.note || null,
                physioFields: row.physioFields ?? null,
                siteIds: row.siteIds ?? [],
                siteApplyMode: row.siteApplyMode ?? null,
                siteLaterality: row.siteLaterality ?? {},
                preferredPractitionerId: masseurIdFor(row.procedureCode),
              })),
              ...(extraRemovals.length > 0 ? { removals: extraRemovals } : {}),
            }),
          },
        );
        const extraBody = await res.json().catch(() => ({}));
        const extraPayload = extraBody.data ?? extraBody;
        if (res.ok && Array.isArray(extraPayload.misses) && extraPayload.misses.length > 0) {
          const extraNoon = noonMissNames(extraPayload.misses);
          const otherMisses = extraPayload.misses.filter(
            (row: { reason?: string }) => row.reason !== "no_slot" && row.reason !== "no_day",
          );
          if (extraNoon.length > 0) {
            const names = [...new Set([...(pendingCheckout?.names ?? []), ...extraNoon])];
            pendingCheckout = {
              names,
              package: pendingCheckout?.package === true,
              extras: true,
            };
          }
          if (otherMisses.length > 0) {
            toastPackageAssignOutcome(
              extras.map((row) => ({
                procedureCode: row.procedureCode,
                procedureName: row.procedureName,
                qty: row.qty,
              })),
              otherMisses,
              (key, values) => tPhysio(key, values),
            );
          }
        }
        if (!res.ok) {
          const code = typeof extraBody?.code === "string" ? extraBody.code : null;
          showApiError(
            {
              error:
                code === "QUOTA_REMAINING"
                  ? tPhysio("packageAssignQuotaRemaining")
                  : code === "NO_PRICE"
                    ? tPhysio("labExtraNoPrice")
                  : code === "CABIN_SEX"
                    ? tPhysio("packageAssignMissCabinSex")
                  : code === "MASSEUR_NOT_SKILLED"
                    ? tPhysio("masseurNotSkilled")
                  : typeof extraBody?.error === "string"
                    ? extraBody.error
                    : tc("saveFailed"),
            },
          );
          return;
        }
      }
      setStartOpen(false);
      setDraft([]);
      setExtraDraft([]);
      setExtraPendingCut({});
      setPendingCancel(new Set());
      setPendingCut({});
      closeForm();
      onSaved();
      if (pendingCheckout) {
        setCheckoutAsk(pendingCheckout);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function bumpPlusOne(row: PackageAssignedAgg) {
    const key = assignedKey(row);
    if (pendingCancel.has(key)) {
      setPendingCancel((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    const cut = pendingCut[key] ?? 0;
    if (cut > 0) {
      setPendingCut((prev) => {
        const next = { ...prev };
        if (cut <= 1) delete next[key];
        else next[key] = cut - 1;
        return next;
      });
      return;
    }
    const quota = menuQuotaForAssigned(row);
    const rem = draftRemaining.get(quota) ?? 0;
    const detail = {
      note: row.note ?? "",
      physioFields: row.physioFields ?? null,
      siteIds: row.siteIds ?? [],
      siteApplyMode: row.siteApplyMode ?? null,
      siteLaterality: row.siteLaterality,
      paramsLabel: row.paramsLabel ?? "",
    };
    if (rem < 1) {
      pushPaid(row.procedureCode, row.procedureName, 1, detail);
      return;
    }
    pushDraft({
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      qty: 1,
      ...detail,
      fingerprint: regimeOf(row),
      burnPoolCode: quota !== row.procedureCode ? quota : null,
    });
  }

  function peelPaid(code: string, regimeKey: string): boolean {
    const row = extraDraft.find((r) => r.procedureCode === code && regimeOf(r) === regimeKey);
    if (!row) return false;
    setExtraDraft((prev) =>
      prev.flatMap((item) => {
        if (item.key !== row.key) return [item];
        if (item.qty <= 1) return [];
        return [{ ...item, qty: item.qty - 1 }];
      }),
    );
    return true;
  }

  function bumpMinusOne(row: PackageAssignedAgg) {
    if (row.qty < 1) return;
    const key = assignedKey(row);
    const matching = draft.find((d) => draftMatchesAssigned(d, row, menuQuotaForAssigned(row)));
    if (matching) {
      setDraft((prev) =>
        prev.flatMap((d) => {
          if (d.key !== matching.key) return [d];
          if (d.qty <= 1) return [];
          return [{ ...d, qty: d.qty - 1 }];
        }),
      );
      return;
    }
    const kept = Math.max(row.doneQty ?? 0, row.qty - (row.movableOrderIds?.length ?? 0));
    const cut = pendingCut[key] ?? 0;
    const live = row.qty - cut;
    if (live - 1 < kept) return;
    setPendingCut((prev) => ({ ...prev, [key]: cut + 1 }));
  }

  function bumpLeftoverPlus(line: DraftLine) {
    const quota = line.burnPoolCode || line.procedureCode;
    const rem = draftRemaining.get(quota) ?? 0;
    if (rem < 1) {
      pushPaid(line.procedureCode, line.procedureName, 1, {
        note: line.note,
        physioFields: line.physioFields ?? null,
        siteIds: line.siteIds ?? [],
        siteApplyMode: line.siteApplyMode ?? null,
        siteLaterality: line.siteLaterality,
        paramsLabel: line.paramsLabel,
      });
      return;
    }
    setDraft((prev) =>
      prev.map((d) => (d.key === line.key ? { ...d, qty: d.qty + 1 } : d)),
    );
  }

  function bumpLeftoverMinus(line: DraftLine) {
    setDraft((prev) =>
      prev.flatMap((d) => {
        if (d.key !== line.key) return [d];
        if (d.qty <= 1) return [];
        return [{ ...d, qty: d.qty - 1 }];
      }),
    );
  }

  function markRemoveAssigned(row: PackageAssignedAgg) {
    if (row.locked) return;
    const key = assignedKey(row);
    setPendingCancel((prev) => new Set(prev).add(key));
    setDraft((prev) => prev.filter((d) => !draftMatchesAssigned(d, row, menuQuotaForAssigned(row))));
  }

  function openReplace(fromCode?: string) {
    const from =
      fromCode && bathFromOptions.some((row) => row.value === fromCode)
        ? fromCode
        : bathFromOptions[0]?.value ?? "";
    setReplaceFrom(from);
    setReplaceBatchId(null);
    setReplaceQty(1);
    setReplaceTo("");
    setReplaceReason("");
    setReplaceOpen(true);
  }

  async function submitReplace() {
    if (!replaceFrom || !replaceTo || replaceQty < 1) return;
    const reason = replaceReason.trim();
    if (reason.length < 7) {
      showApiError({ error: replaceReasonToast() });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/package-assign/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromCode: replaceFrom,
            toCode: replaceTo,
            qty: replaceQty,
            reason,
          }),
        },
      );
      const d = await res.json();
      if (!res.ok) {
        showApiError({ error: assignSaveMessage(d) }, tc("failed"));
        return;
      }
      setReplaceOpen(false);
      setReplaceReason("");
      await load();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  function unitOf(code: string): number {
    const n = extraPrices[code];
    return Number.isFinite(n) && n > 0 ? n : 25;
  }

  function extraMinus(code: string, regimeKey: string) {
    if (peelPaid(code, regimeKey)) return;
    const key = extraCutKey(code, regimeKey);
    const pendingCount = extraPending.filter(
      (row) => extraCutKey(row.procedureCode, row.regimeKey ?? "") === key,
    ).length;
    const cut = extraPendingCut[key] ?? 0;
    if (cut >= pendingCount) return;
    setExtraPendingCut((prev) => ({ ...prev, [key]: cut + 1 }));
  }

  function extraPlus(
    code: string,
    name: string,
    paramsLabel: string,
    regimeKey: string,
    detail?: Pick<ExtraDraftLine, "physioFields" | "siteIds" | "siteApplyMode" | "siteLaterality" | "note">,
  ) {
    const key = extraCutKey(code, regimeKey);
    const cut = extraPendingCut[key] ?? 0;
    if (cut > 0) {
      setExtraPendingCut((prev) => {
        const next = { ...prev };
        if (cut <= 1) delete next[key];
        else next[key] = cut - 1;
        return next;
      });
      return;
    }
    if (refuseWrongSex(code)) return;
    const hit = extraDraft.find(
      (row) => row.procedureCode === code && regimeOf(row) === regimeKey,
    );
    if (hit) {
      setExtraDraft((prev) =>
        prev.map((item) => (item.key === hit.key ? { ...item, qty: item.qty + 1 } : item)),
      );
      return;
    }
    pushPaid(code, name, 1, { paramsLabel, ...detail });
  }

  const shell = (
    <ModalShell
      open={open}
      title={labels.title}
      onClose={requestClose}
      maxWidthClass={`${MODAL_FULL_CLASS} !h-[90vh]`}
      bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={requestClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!canSave}
            onClick={() => void save()}
          >
            {labels.save}
          </button>
        </div>
      }
    >
      {packagePin ? (
        <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>
          {tPhysio("packageAssignPinnedVersion", { pin: packagePin })}
        </p>
      ) : null}
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      {softWarn ? (
        <p className="mb-2 text-[12px] text-amber-700">
          {labels.softWarnPrefix}: {softWarn}
        </p>
      ) : null}
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-hidden md:grid-cols-2">
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <h4 className="text-sm font-medium">{tPhysio("packageBalanceTitle")}</h4>
          {transferBalances.filter((b) => b.assignable !== false).length > 0 ? (
            <div className="mb-3">
              <h4 className="text-sm font-medium">{tPhysio("replacedProceduresTitle")}</h4>
              <ul className="space-y-1">
                {transferBalances
                  .filter((b) => b.assignable !== false)
                  .map((b) => {
                    const rem = draftRemaining.get(b.procedureCode) ?? b.remaining;
                    return (
                      <li
                        key={b.procedureCode}
                        className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium leading-tight">{b.procedureName}</div>
                          <p className={`text-[11px] leading-tight ${TEXT_MUTED_CLASS}`}>
                            {labels.remaining}: {rem} / {b.quotaTotal}
                          </p>
                          {(b.transfers?.length ?? 0) > 0 && transferInfoCode === b.procedureCode ? (
                            <ul className={`mt-1 space-y-0.5 text-[11px] ${TEXT_MUTED_CLASS}`}>
                              {b.transfers!.map((row, index) => (
                                <li key={`${row.createdAt}-${index}`}>
                                  {bakuDateDisplay(row.createdAt)} · {row.qty} · {row.reason}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {(b.transfers?.length ?? 0) > 0 ? (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={tPhysio("replaceInfo")}
                              onClick={() =>
                                setTransferInfoCode((cur) =>
                                  cur === b.procedureCode ? null : b.procedureCode,
                                )
                              }
                            >
                              <Info className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`${SECONDARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                            disabled={rem < 1 || busy}
                            onClick={() => fillAll(b.procedureCode)}
                          >
                            {labels.all}
                          </button>
                          <button
                            type="button"
                            className={`${PRIMARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                            disabled={rem < 1 || busy}
                            onClick={() => openForm(b.procedureCode)}
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
          {menuBalances.length === 0 ? (
            <p className={TEXT_MUTED_CLASS}>{labels.emptyLeft}</p>
          ) : (
            <ul className="space-y-1">
              {menuBalances
                .map((b) => {
                const rem = draftRemaining.get(b.procedureCode) ?? b.remaining;
                const picker = needsPicker(b);
                return (
                  <li
                    key={b.procedureCode}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium leading-tight">{b.procedureName}</div>
                      <p className={`text-[11px] leading-tight ${TEXT_MUTED_CLASS}`}>
                        {labels.remaining}: {rem} / {b.quotaTotal}
                        {b.isPool
                          ? ` · ${tPhysio("packageAssignPoolHint")}`
                          : b.isQuotaAlias
                            ? ` · ${tPhysio("packageAssignAliasHint")}`
                            : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {b.allowReplace ? (
                        <button
                          type="button"
                          className={`${SECONDARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                          disabled={busy || rem < 1}
                          onClick={() => openReplace(b.procedureCode)}
                        >
                          {tPhysio("replaceBaths")}
                        </button>
                      ) : null}
                      {b.fulfillment === "LAB_ORDER" ? null : (
                      <button
                        type="button"
                        className={`${SECONDARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                        disabled={rem < 1 || busy}
                        onClick={() => fillAll(b.procedureCode)}
                      >
                        {labels.all}
                      </button>
                      )}
                      <button
                        type="button"
                        className={`${PRIMARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                        disabled={rem < 1 || busy}
                        onClick={() => openForm(b.procedureCode)}
                        title={picker ? labels.pickPoolSku ?? tPhysio("packageAssignPoolHint") : undefined}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="pt-3">
            <h4 className="mb-2 text-sm font-medium">{tPhysio("extraProceduresTitle")}</h4>
            <div className="mb-2">
              <CatalogField
                kind="FREE_TEXT"
                label={tPhysio("catalogSearch")}
                value={catalogQuery}
                onChange={(v) => {
                  const next = String(v ?? "");
                  setCatalogQuery(next);
                  if (!next.trim()) setOpenDepts(new Set());
                }}
                options={[]}
                widthPreset="select"
              />
            </div>
            {(() => {
              const q = catalogQuery.trim().toLocaleLowerCase(locale);
              const groups = extraGroups
                .map(([group, items]) => {
                  const visible = !q || group.toLocaleLowerCase(locale).includes(q)
                    ? items
                    : items.filter((item) => item.label.toLocaleLowerCase(locale).includes(q));
                  return [group, visible] as const;
                })
                .filter(([, items]) => items.length > 0);
              if (q && groups.length === 0) {
                return <p className={TEXT_MUTED_CLASS}>{tPhysio("catalogSearchEmpty")}</p>;
              }
              return groups.map(([group, items]) => {
              const deptOpen = q.length > 0 || openDepts.has(group);
              return (
              <div key={group} className="mb-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 py-1 text-left text-[12px] font-semibold text-[#1F4E79]"
                  onClick={() =>
                    setOpenDepts((prev) => {
                      const next = new Set(prev);
                      if (next.has(group)) next.delete(group);
                      else next.add(group);
                      return next;
                    })
                  }
                >
                  <span>{group}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${deptOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {deptOpen ? (
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li
                      key={item.value}
                      className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                    >
                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                      <button
                        type="button"
                        className={`${PRIMARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                        disabled={busy || clinicalLock}
                        onClick={() => openCatalogLine(item.value, item.label)}
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
                ) : null}
              </div>
              );
            });
            })()}
          </div>
        </div>

        <div className="relative flex h-full min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">{tPhysio("assignedReceiptTitle")}</h4>
          </div>
          {draft.length > 0 ? (
            <p className={`mb-2 text-[11px] leading-snug ${TEXT_MUTED_CLASS}`}>
              {tPhysio("saxlaLineOrderHint")}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {(() => {
            type Lane = {
              key: string;
              code: string;
              name: string;
              params: string[];
              paramsLabel: string;
              assigned?: PackageAssignedAgg;
              pkgDraft?: DraftLine;
              pkgQty: number;
              pkgLocked: boolean;
              extraQty: number;
              extraUnit: number;
              paidQty: number;
              regimeKey: string;
              physioFields?: Record<string, unknown> | null;
              siteIds?: string[];
              siteApplyMode?: "TURN" | "TOGETHER" | null;
              siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
            };
            const lanes: Lane[] = [];
            const claimedExtra = new Set<string>();
            const usedPending = new Set<string>();
            const usedPaid = new Set<string>();
            const takeExtra = (code: string, regimeKey: string) => {
              const hit = extraDraft.find(
                (row) =>
                  !claimedExtra.has(row.key) &&
                  row.procedureCode === code &&
                  regimeOf(row) === regimeKey,
              );
              if (hit) claimedExtra.add(hit.key);
              return hit;
            };
            const takePending = (code: string, regimeKey: string) => {
              const rows = extraPending.filter(
                (row) =>
                  row.procedureCode === code &&
                  (row.regimeKey ?? "") === regimeKey &&
                  !usedPending.has(row.id),
              );
              const cut = extraPendingCut[extraCutKey(code, regimeKey)] ?? 0;
              const keep = rows.slice(0, Math.max(0, rows.length - cut));
              for (const row of rows) usedPending.add(row.id);
              return keep;
            };
            const takePaid = (code: string, regimeKey: string) =>
              paidExtras.filter((row) => {
                if (row.procedureCode !== code || (row.regimeKey ?? "") !== regimeKey || usedPaid.has(row.id)) {
                  return false;
                }
                usedPaid.add(row.id);
                return true;
              });
            const pushLane = (
              code: string,
              name: string,
              regimeKey: string,
              paramsLabel: string,
              params: string[],
              assigned: PackageAssignedAgg | undefined,
              pkgDraft: DraftLine | undefined,
              pkgQty: number,
              pkgLocked: boolean,
              detail?: Pick<
                ExtraDraftLine,
                "physioFields" | "siteIds" | "siteApplyMode" | "siteLaterality"
              >,
            ) => {
              const extra = takeExtra(code, regimeKey);
              const pending = takePending(code, regimeKey);
              const paid = takePaid(code, regimeKey);
              const unpaidQty = (extra?.qty ?? 0) + pending.length;
              if (pkgQty < 1 && unpaidQty < 1 && paid.length < 1 && !assigned) return;
              const unit = extra?.amountNet || pending[0]?.amountNet || unitOf(code);
              const source = detail ?? extra ?? pending[0];
              lanes.push({
                key: assigned ? assignedKey(assigned) : pkgDraft?.key ?? `x:${code}:${regimeKey}`,
                code,
                name,
                params,
                paramsLabel,
                assigned,
                pkgDraft,
                pkgQty,
                pkgLocked,
                extraQty: unpaidQty,
                extraUnit: unit,
                paidQty: paid.length,
                regimeKey,
                physioFields: source?.physioFields,
                siteIds: source?.siteIds,
                siteApplyMode: source?.siteApplyMode,
                siteLaterality: source?.siteLaterality,
              });
            };
            for (const row of assigned) {
              const key = assignedKey(row);
              const wiped = pendingCancel.has(key);
              if (wiped && (row.doneQty ?? 0) < 1) continue;
              const pkgDraft = draft.find((d) => draftMatchesAssigned(d, row, menuQuotaForAssigned(row)));
              const cut = wiped ? row.qty : pendingCut[key] ?? 0;
              pushLane(
                row.procedureCode,
                row.procedureName,
                regimeOf(row),
                row.paramsLabel ?? "",
                paramLinesOf(row.paramsLabel, row.paramsLines),
                row,
                pkgDraft,
                Math.max(row.doneQty ?? 0, row.qty - cut) + (pkgDraft?.qty ?? 0),
                row.locked,
                row,
              );
            }
            for (const line of leftoverDraft) {
              pushLane(
                line.procedureCode,
                line.procedureName,
                regimeOf(line),
                line.paramsLabel,
                paramLinesOf(line.paramsLabel),
                undefined,
                line,
                line.qty,
                false,
                line,
              );
            }
            for (const row of extraDraft) {
              if (claimedExtra.has(row.key)) continue;
              pushLane(
                row.procedureCode,
                row.procedureName,
                regimeOf(row),
                row.paramsLabel,
                paramLinesOf(row.paramsLabel),
                undefined,
                undefined,
                0,
                false,
                row,
              );
            }
            for (const row of [...extraPending, ...paidExtras]) {
              if (usedPending.has(row.id) || usedPaid.has(row.id)) continue;
              const regimeKey = "regimeKey" in row ? row.regimeKey ?? "" : "";
              if (lanes.some((lane) => lane.code === row.procedureCode && lane.regimeKey === regimeKey)) continue;
              pushLane(row.procedureCode, row.procedureName, regimeKey, "", [], undefined, undefined, 0, false);
            }
            if (lanes.length === 0) {
              return <p className={TEXT_MUTED_CLASS}>{labels.emptyRight}</p>;
            }
            const stepper = (
              qty: number,
              onMinus: () => void,
              onPlus: () => void,
              plusDisabled: boolean,
              minusDisabled = false,
            ) => (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  disabled={busy || qty < 1 || minusDisabled}
                  onClick={onMinus}
                  aria-label={labels.qtyDown ?? "−1"}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="w-6 text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  disabled={busy || plusDisabled}
                  onClick={onPlus}
                  aria-label={labels.qtyUp ?? "+1"}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            );
            return (
              <>
              <ul className="space-y-2">
                {lanes.map((lane) => {
                  const saxlaNo = lane.pkgDraft
                    ? saxlaOrderByDraftKey.get(lane.pkgDraft.key)
                    : undefined;
                  const movable = lane.assigned
                    ? lane.assigned.movableOrderIds?.length ??
                      (lane.pkgLocked ? 0 : lane.assigned.qty)
                    : 0;
                  const kept = lane.assigned
                    ? Math.max(lane.assigned.doneQty ?? 0, lane.assigned.qty - movable)
                    : 0;
                  const packageMinusDisabled = Boolean(lane.assigned) && lane.pkgQty <= kept;
                  return (
                    <li
                      key={lane.key}
                      id={`assign-lane-${lane.code}:${lane.regimeKey}`}
                      className={`${CARD_CONTAINER_CLASS} px-3 py-2 text-[13px] ${
                        planFocus === `${lane.code}:${lane.regimeKey}` ? "ring-2 ring-[#1F4E79]" : ""
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {saxlaNo != null ? (
                              <span
                                className={`mr-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-[#E8EEF4] px-1 text-[11px] font-semibold tabular-nums ${TEXT_MUTED_CLASS}`}
                                title={tPhysio("saxlaLineOrderHint")}
                              >
                                {saxlaNo}
                              </span>
                            ) : null}
                            {lane.name}
                          </div>
                          {lane.params.map((line) => (
                            <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                              {line}
                            </p>
                          ))}
                          {(lane.assigned?.doneQty ?? 0) > 0 ? (
                            <p className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                              {tPhysio("doneOnCard", { count: lane.assigned?.doneQty ?? 0 })}
                            </p>
                          ) : null}
                        </div>
                        {lane.assigned && !lane.pkgLocked ? (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                              disabled={busy}
                              onClick={() => markRemoveAssigned(lane.assigned!)}
                              aria-label={labels.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {lane.pkgQty > 0 || lane.assigned || lane.pkgDraft ? (
                        <div className="flex items-center justify-between gap-2 py-1">
                          <span className={TEXT_MUTED_CLASS}>{tPhysio("fromPackage")}</span>
                          {stepper(
                            lane.pkgQty,
                            () => {
                              if (lane.assigned) bumpMinusOne(lane.assigned);
                              else if (lane.pkgDraft) bumpLeftoverMinus(lane.pkgDraft);
                            },
                            () => {
                              if (lane.assigned) bumpPlusOne(lane.assigned);
                              else if (lane.pkgDraft) bumpLeftoverPlus(lane.pkgDraft);
                            },
                            false,
                            packageMinusDisabled,
                          )}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 py-1">
                        <span className={TEXT_MUTED_CLASS}>{tPhysio("extraLine")}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-right text-[12px] tabular-nums">
                            {lane.extraUnit.toFixed(2)}
                            <span className={`block ${TEXT_MUTED_CLASS}`}>
                              {(lane.extraUnit * lane.extraQty).toFixed(2)}
                            </span>
                          </span>
                          {stepper(
                            lane.extraQty,
                            () => extraMinus(lane.code, lane.regimeKey),
                            () =>
                              extraPlus(lane.code, lane.name, lane.paramsLabel, lane.regimeKey, {
                                note: "",
                                physioFields: lane.physioFields,
                                siteIds: lane.siteIds,
                                siteApplyMode: lane.siteApplyMode,
                                siteLaterality: lane.siteLaterality,
                              }),
                            false,
                          )}
                        </div>
                      </div>
                      {masseurOptions[lane.code]?.length && !lane.pkgLocked ? (
                        <div className="max-w-xs py-1">
                          <CatalogField
                            kind="SEARCHABLE"
                            label={tPhysio("masseurLabel")}
                            value={masseurByCode[lane.code] ?? ""}
                            onChange={(value) =>
                              setMasseurByCode((prev) => ({
                                ...prev,
                                [lane.code]: String(value ?? ""),
                              }))
                            }
                            options={[
                              { value: "", label: tPhysio("masseurAny") },
                              ...(masseurOptions[lane.code] ?? []).map((person) => ({
                                value: person.id,
                                label: person.fullName,
                              })),
                            ]}
                            widthPreset="select"
                          />
                        </div>
                      ) : null}
                      {lane.paidQty > 0 ? (
                        <p className="pt-1 text-[13px] font-semibold text-[#1F4E79]">
                          {tPhysio("paidLine")}: {lane.paidQty}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              </>
            );
          })()}
          </div>
          <p className="shrink-0 border-t border-slate-200 pt-3 text-right text-lg font-semibold">
            {tPhysio("amountDue")}: {(extraDraftTotal + extraPendingTotal).toFixed(2)} AZN
          </p>
          {formBurnPool || formCode ? (
            <div className="absolute inset-0 z-10 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="min-w-0 flex-1 font-medium">
                  {formBurnPool && !formCode
                    ? balances.find((b) => b.procedureCode === formBurnPool)?.procedureName ??
                      formBurnPool
                    : formName}
                </h4>
                {formCode ? (
                  <label className="flex shrink-0 items-center gap-1 text-[12px]">
                    {labels.qty}
                    <input
                      className={`${MODAL_INPUT_CLASS} w-[5ch]`}
                      type="number"
                      min={1}
                      max={40}
                      value={formQty}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 1;
                        const cap = 40;
                        const n = Math.min(cap, Math.max(1, raw));
                        setFormQty(n);
                        if (n <= 1) {
                          setFormPhysio((prev) => ({
                            ...prev,
                            physioFields: { ...prev.physioFields, bathSequence: null },
                          }));
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {formCode && masseurOptions[formCode]?.length ? (
                <div className="mb-2 max-w-xs">
                  <CatalogField
                    kind="SEARCHABLE"
                    label={tPhysio("masseurLabel")}
                    value={masseurByCode[formCode] ?? ""}
                    onChange={(value) =>
                      setMasseurByCode((prev) => ({
                        ...prev,
                        [formCode]: String(value ?? ""),
                      }))
                    }
                    options={[
                      { value: "", label: tPhysio("masseurAny") },
                      ...(masseurOptions[formCode] ?? []).map((person) => ({
                        value: person.id,
                        label: person.fullName,
                      })),
                    ]}
                    widthPreset="select"
                  />
                </div>
              ) : null}
              {formBurnPool && poolSkuOptions.length > 1 ? (
                <div className="mb-2 max-w-xs">
                  <CatalogField
                    kind="SEARCHABLE"
                    label={labels.pickPoolSku ?? "Procedure"}
                    value={formCode ?? ""}
                    onChange={(v) => selectPoolSku(String(v ?? ""))}
                    options={poolSkuOptions}
                    widthPreset="select"
                  />
                </div>
              ) : null}
              {formLane === "extra" && formCode ? (
                <p className="mb-2 text-[13px] font-medium text-[#2C3E50]">
                  {tPhysio("price")}: {unitOf(formCode).toFixed(2)} AZN
                  {" · "}
                  {tPhysio("extrasDraftTotal")}:{" "}
                  {(unitOf(formCode) * Math.max(1, formQty)).toFixed(2)} AZN
                </p>
              ) : null}
              {formCode && !formIsStudy ? (
                <>
                  <div className="mb-3">
                    <PhysioSiteChips
                      value={formPhysio}
                      catalog={catalog}
                      programs={programs}
                      substances={substances}
                      locale={locale}
                      editable
                      compact
                      sessionQty={formQty}
                      labels={physioLabels}
                      onSitesChange={(siteIds) =>
                        setFormPhysio((prev) => ({ ...prev, siteIds }))
                      }
                      onModeChange={(siteApplyMode) =>
                        setFormPhysio((prev) => ({ ...prev, siteApplyMode }))
                      }
                      onNoteBlur={(note) => setFormPhysio((prev) => ({ ...prev, note }))}
                      onLateralityChange={(siteId, laterality) =>
                        setFormPhysio((prev) => ({
                          ...prev,
                          siteLaterality: { ...prev.siteLaterality, [siteId]: laterality },
                        }))
                      }
                      onFieldsChange={(physioFields) =>
                        setFormPhysio((prev) => ({ ...prev, physioFields }))
                      }
                      hideFields={
                        formCode && /NAFTALAN|VANN|BATH/i.test(formCode)
                          ? ["DAY_BLOCK", "BATH_SEQUENCE"]
                          : []
                      }
                    />
                  </div>
                </>
              ) : !formCode ? (
                <p className={`mb-3 text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {labels.pickPoolSku ?? tPhysio("packageAssignPoolHint")}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={closeForm}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={!formCode}
                  onClick={addDraft}
                >
                  {labels.addToDraft}
                </button>
              </div>
            </div>
          ) : null}

          {replaceOpen ? (
            <div className="absolute inset-0 z-20 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h4 className="mb-2 font-medium">{tPhysio("replacedProceduresTitle")}</h4>
              <div className="mb-2 max-w-xs">
                <CatalogField
                  kind="SEARCHABLE"
                  label={tPhysio("replaceBathsFrom")}
                  value={replaceFrom}
                  onChange={(v) => setReplaceFrom(String(v ?? ""))}
                  options={bathFromOptions}
                  widthPreset="select"
                />
              </div>
              <div className="mb-2 max-w-xs">
                <CatalogField
                  kind="SEARCHABLE"
                  label={tPhysio("replaceBathsTo")}
                  value={replaceTo}
                  onChange={(v) => setReplaceTo(String(v ?? ""))}
                  options={replaceToOptions}
                  widthPreset="select"
                />
              </div>
              <label className="mb-3 block text-[12px]">
                {tPhysio("replaceBathsQty")}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1 w-[6ch]`}
                  type="number"
                  min={1}
                  value={replaceQty}
                  onChange={(e) => setReplaceQty(Number(e.target.value) || 1)}
                />
              </label>
              <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>{todayBakuYmd()}</p>
              <div className="mb-3 max-w-xs">
                <CatalogField
                  kind="FREE_TEXT"
                  label={tPhysio("replaceBathsReason")}
                  value={replaceReason}
                  onChange={(v) => setReplaceReason(String(v ?? ""))}
                  options={[]}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => setReplaceOpen(false)}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy || !replaceFrom || !replaceTo || replaceReason.trim().length < 7}
                  onClick={() => void submitReplace()}
                >
                  {tPhysio("replaceBaths")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        </div>
        <StayDayGrid
          plan={stayPlan}
          focusKey={planFocus}
          onFocus={(procedureCode, regimeKey) => {
            const key = `${procedureCode}:${regimeKey}`;
            setPlanFocus(key);
            document.getElementById(`assign-lane-${key}`)?.scrollIntoView({ block: "nearest" });
          }}
          emptyLabel={tPhysio("stayPlanEmpty")}
          openLabel={tPhysio("stayPlanOpen")}
          noonLabel={tPhysio("stayPlanNoon")}
          legendPackage={tPhysio("stayPlanPackage")}
          legendPaid={tPhysio("stayPlanPaid")}
          legendDone={tPhysio("stayPlanDone")}
        />
      </div>
    </ModalShell>
  );
  function answerCheckout(place: boolean) {
    const ask = checkoutAsk;
    setCheckoutAsk(null);
    setBusy(true);
    void (async () => {
      try {
        if (!ask) return;
        if (place && ask.names.length > 0) {
          const left: Array<{ procedureName?: string; procedureCode?: string }> = [];
          if (ask.package) {
            const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checkoutMorning: true, lines: [] }),
            });
            const body = await res.json().catch(() => ({}));
            const payload = body.data ?? body;
            if (!res.ok) showApiError({ error: assignSaveMessage(body) }, tc("saveFailed"));
            else if (Array.isArray(payload.misses)) left.push(...payload.misses);
          }
          if (ask.extras) {
            const res = await fetch(`/api/sanatorium/episodes/${episodeId}/extras-prescribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checkoutMorning: true, lines: [] }),
            });
            const body = await res.json().catch(() => ({}));
            const payload = body.data ?? body;
            if (!res.ok) showApiError({ error: assignSaveMessage(body) }, tc("saveFailed"));
            else if (Array.isArray(payload.misses)) left.push(...payload.misses);
          }
          const leftNames = [
            ...new Set(
              left
                .map((row) => row.procedureName || row.procedureCode)
                .filter((name): name is string => Boolean(name)),
            ),
          ].join(", ");
          if (left.length > 0) {
            showApiError({
              error: placeMissText(left) || tPhysio("packageAssignCheckoutNoonLeft", { names: leftNames }),
            });
          }
        } else {
          if (ask.package) {
            await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ releaseUnseated: true, lines: [] }),
            });
          }
          if (ask.extras) {
            await fetch(`/api/sanatorium/episodes/${episodeId}/extras-prescribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ releaseHeld: true, lines: [] }),
            });
          }
        }
        await load();
        onSaved();
      } finally {
        setBusy(false);
      }
    })();
  }
  const discard = (
    <ModalShell
      open={discardOpen}
      title={tPhysio("packageAssignDiscardTitle")}
      onClose={() => setDiscardOpen(false)}
      overlayZClass="z-[400]"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setDiscardOpen(false);
              onClose();
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => {
              setDiscardOpen(false);
              void save(startOpen ? { date: startDate, hour: startHour } : undefined);
            }}
          >
            {labels.save}
          </button>
        </div>
      }
    >
      <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tPhysio("packageAssignDiscardBody")}</p>
    </ModalShell>
  );
  const startAsk = (
    <ModalShell
      open={startOpen}
      title={tPhysio("packageAssignStartTitle")}
      onClose={() => setStartOpen(false)}
      overlayZClass="z-[400]"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setStartOpen(false)}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !startDate || !startHour}
            onClick={() => void save({ date: startDate, hour: startHour })}
          >
            {labels.save}
          </button>
        </div>
      }
    >
      <p className={`mb-3 text-sm ${TEXT_MUTED_CLASS}`}>{tPhysio("packageAssignStartHint")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <DatePicker
          label={tPhysio("packageAssignStartDate")}
          value={startDate}
          onChange={(iso) => {
            const yesterday = addBakuDays(todayBakuYmd(), -1);
            if (iso && iso < yesterday) {
              setStartDate(yesterday);
              return;
            }
            setStartDate(iso);
          }}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <div className="w-28">
          <CatalogField
            kind="CLOSED_SMALL"
            label={tPhysio("packageAssignStartHour")}
            value={startHour}
            onChange={(value) => setStartHour(String(value ?? "9"))}
            options={Array.from({ length: 8 }, (_, index) => {
              const hour = String(9 + index);
              return { value: hour, label: `${hour.padStart(2, "0")}:00` };
            })}
          />
        </div>
      </div>
    </ModalShell>
  );
  const checkout = (
    <ModalShell
      open={checkoutAsk != null}
      title={tPhysio("packageAssignCheckoutAskTitle")}
      onClose={() => answerCheckout(false)}
      overlayZClass="z-[400]"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => answerCheckout(false)}
          >
            {tPhysio("packageAssignCheckoutAskNo")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => answerCheckout(true)}
          >
            {tPhysio("packageAssignCheckoutAskYes")}
          </button>
        </div>
      }
    >
      <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tPhysio("packageAssignCheckoutAskBody")}</p>
    </ModalShell>
  );
  const tree = (
    <>
      {shell}
      {discard}
      {startAsk}
      {checkout}
    </>
  );
  if (typeof document === "undefined") return tree;
  return createPortal(tree, document.body);
}
