"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { packageAssignBlockText } from "@/lib/package-assign-block";
import {
  formatPackageAssignMissLines,
  toastPackageAssignOutcome,
} from "@/lib/package-assign-toasts";
import {
  isBathQuotaLine,
  isBathTransferQuota,
  isReplaceableQuotaLine,
  bathTransferSku,
  parseTransferQuota,
} from "@/domain/sanatorium/package-assign-quota";
import { EPISODE_MODAL_CLASS } from "@/components/sanatorium/episode-modal-class";
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

function assignedKey(row: PackageAssignedAgg): string {
  return `${row.procedureCode}|${row.packageQuotaCode ?? ""}|${row.locked ? "L" : "A"}|${row.statusKind}`;
}

function paramLinesOf(label?: string, lines?: string[]): string[] {
  if (lines && lines.length) return lines;
  if (!label?.trim()) return [];
  return label.split(" · ").map((s) => s.trim()).filter(Boolean);
}

function mergeParamLabel(a: string, b: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const lab of [a, b]) {
    for (const part of lab.split(" · ")) {
      const p = part.trim();
      if (p && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out.join(" · ");
}

function draftMatchesAssigned(
  d: DraftLine,
  row: PackageAssignedAgg,
  rowQuota = row.packageQuotaCode || row.procedureCode,
): boolean {
  const quota = d.burnPoolCode || d.procedureCode;
  return d.procedureCode === row.procedureCode && quota === rowQuota;
}

function mergeDraft(prev: DraftLine[], line: Omit<DraftLine, "key">): DraftLine[] {
  const same = prev.find(
    (d) =>
      d.procedureCode === line.procedureCode &&
      (d.burnPoolCode ?? null) === (line.burnPoolCode ?? null),
  );
  if (same) {
    return prev.map((d) =>
      d.key === same.key
        ? {
            ...d,
            qty: d.qty + line.qty,
            paramsLabel: mergeParamLabel(d.paramsLabel, line.paramsLabel),
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
  const [extraPrices, setExtraPrices] = useState<Record<string, number>>({});
  const [extraPending, setExtraPending] = useState<
    Array<{
      id: string;
      procedureCode: string;
      procedureName: string;
      amountNet: number;
      kind?: "procedure" | "lab" | "visit";
    }>
  >([]);
  const [paidExtras, setPaidExtras] = useState<
    Array<{ id: string; procedureCode: string; procedureName: string; amountNet: number }>
  >([]);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());

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
  const [checkoutAsk, setCheckoutAsk] = useState<string[] | null>(null);
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
      "INSTANTIATE_FAILED",
    ];
    const block = known.includes(payload.blockReason) ? payload.blockReason : null;
    setBlockReason(block);
    const blockText = packageAssignBlockText(
      tPhysio,
      block,
      typeof payload.packageCode === "string" ? payload.packageCode : "",
    );
    if (blockText) {
      setError(blockText);
      showApiError({ error: blockText });
    }
    else if (payload.softWarnDay1) setSoftWarn(String(payload.softWarnDay1));
  }, [episodeId, locale, tPhysio]);

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
    void load();
    void (async () => {
      try {
        const [catRes, typesRes, extraRes] = await Promise.all([
          fetch("/api/physio-catalog"),
          fetch(`/api/procedure-types?locale=${encodeURIComponent(locale)}`),
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
          const pending = Array.isArray(payload.items) ? payload.items : [];
          setExtraPending(
            pending.map(
              (row: {
                id: string;
                procedureCode?: string;
                procedureName?: string;
                amountNet?: number;
                kind?: "procedure" | "lab" | "visit";
              }) => ({
                id: row.id,
                procedureCode: row.procedureCode || "",
                procedureName: row.procedureName || row.id,
                amountNet: Number(row.amountNet || 0),
                kind: row.kind === "lab" || row.kind === "visit" ? row.kind : "procedure",
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
              }) => ({
                id: row.id,
                procedureCode: row.procedureCode || "",
                procedureName: row.procedureName || row.id,
                amountNet: Number(row.amountNet || 0),
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
  }, [open, load, locale, episodeId]);

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
      const cut = pendingCancel.has(key) ? row.qty : pendingCut[key] ?? 0;
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
  const canSaveExtras = !clinicalLock && (extraDraft.length > 0 || formLane === "extra");
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
            isBathQuotaLine(b.procedureCode, b.procedureName),
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
    setExtraDraft((prev) => {
      const hit = prev.find((row) => row.procedureCode === code && row.paramsLabel === paramsLabel);
      if (hit) {
        return prev.map((row) => (row.key === hit.key ? { ...row, qty: row.qty + qty } : row));
      }
      return [
        ...prev,
        {
          key: `${code}-paid-${paramsLabel || "plain"}`,
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
    let next = hour + 1;
    let date = todayBakuYmd();
    if (next >= 17) {
      next = 9;
      date = addBakuDays(date, 1);
    }
    if (next < 9) next = 9;
    return { date, hour: String(next) };
  }

  function placeMissText(
    misses: Array<{ ymd?: string; reason?: string; procedureName?: string; procedureCode?: string }> | undefined,
  ): string {
    return formatPackageAssignMissLines(misses, tPhysio);
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
    if (code === "PLACE_FAILED") return tPhysio("packageAssignPlaceFailed");
    if (code === "NOT_IN_PROCEDURES") return tPhysio("packageAssignNotInProcedures");
    if (code === "NO_SERVICE") return tPhysio("packageAssignNoService");
    if (code === "NO_CARE_TEAM") return tPhysio("packageAssignNoCareTeam");
    if (code === "LAB_ALREADY_OPEN") return tPhysio("packageAssignLabOpen");
    if (code === "LAB_ONE") return tPhysio("packageAssignLabOne");
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
    if (lines.length === 0 && !hasAdjust && extras.length === 0 && prefs.length === 0) {
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
    let pendingCheckout: string[] | null = null;
    try {
      for (const row of assigned) {
        if (row.locked) continue;
        const key = assignedKey(row);
        const cut = cuts[key] ?? 0;
        const cancelAll = cancelKeys.has(key) || cut >= row.qty;
        if (!cancelAll && cut < 1) continue;
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/package-assign/adjust`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              procedureCode: row.procedureCode,
              ...(cancelAll
                ? { cancelAllActive: true }
                : { targetActiveQty: Math.max(0, row.qty - cut) }),
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
        const noonNames = missRows
          .filter((row: { reason?: string }) => row.reason === "no_slot" || row.reason === "no_day")
          .map((row: { procedureName?: string; procedureCode?: string }) => row.procedureName || row.procedureCode)
          .filter((name: string | undefined): name is string => Boolean(name))
          .filter((name: string, index: number, all: string[]) => all.indexOf(name) === index);
        if (noonNames.length > 0) {
          pendingCheckout = noonNames;
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
      if (extras.length > 0 && !clinicalLock) {
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
            }),
          },
        );
        const extraBody = await res.json().catch(() => ({}));
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
      setPendingCancel(new Set());
      setPendingCut({});
      closeForm();
      onSaved();
      if (pendingCheckout) {
        setCheckoutAsk(pendingCheckout);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function bumpPlusOne(row: PackageAssignedAgg) {
    if (row.locked) return;
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
    if (rem < 1) return;
    pushDraft({
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      qty: 1,
      note: row.note ?? "",
      physioFields: row.physioFields ?? null,
      siteIds: row.siteIds ?? [],
      siteApplyMode: row.siteApplyMode ?? null,
      siteLaterality: row.siteLaterality,
      paramsLabel: row.paramsLabel ?? "",
      fingerprint: `params:${row.paramsLabel ?? ""}`,
      burnPoolCode: quota !== row.procedureCode ? quota : null,
    });
  }

  function peelPaid(code: string, paramsLabel: string): boolean {
    const exact = extraDraft.find((r) => r.procedureCode === code && r.paramsLabel === paramsLabel);
    const row = exact ?? extraDraft.find((r) => r.procedureCode === code);
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
    if (row.locked) return;
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
    const cut = pendingCut[key] ?? 0;
    const live = row.qty - cut;
    if (live <= 1) {
      setPendingCancel((prev) => new Set(prev).add(key));
      return;
    }
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
      fromCode && isReplaceableQuotaLine(fromCode)
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
    if (reason.length < 2) {
      showApiError({ error: tPhysio("replaceBathsNeedReason") });
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

  async function dropPendingExtra(id: string, kind?: "procedure" | "lab" | "visit") {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ orderId: id });
      if (kind === "lab" || kind === "visit") qs.set("kind", kind);
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/extras-prescribe?${qs.toString()}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showApiError(d, tc("failed"));
        return;
      }
      setExtraPending((prev) => prev.filter((row) => row.id !== id));
    } finally {
      setBusy(false);
    }
  }

  function extraMinus(code: string, paramsLabel: string) {
    if (peelPaid(code, paramsLabel)) return;
    const hit = extraPending.find((row) => row.procedureCode === code);
    if (hit) void dropPendingExtra(hit.id, hit.kind);
  }

  function extraPlus(code: string, name: string, paramsLabel: string) {
    if (refuseWrongSex(code)) return;
    const xfer = openTransferForSku(code);
    if (xfer && (draftRemaining.get(xfer) ?? 0) > 0) {
      openForm(xfer);
      return;
    }
    const hit = extraDraft.find(
      (row) => row.procedureCode === code && row.paramsLabel === paramsLabel,
    );
    if (hit) {
      setExtraDraft((prev) =>
        prev.map((item) => (item.key === hit.key ? { ...item, qty: item.qty + 1 } : item)),
      );
      return;
    }
    pushPaid(code, name, 1, { paramsLabel });
  }

  const shell = (
    <ModalShell
      open={open}
      title={labels.title}
      onClose={requestClose}
      maxWidthClass={EPISODE_MODAL_CLASS}
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
            onClick={() =>
              void save(startOpen ? { date: startDate, hour: startHour } : undefined)
            }
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
      {startOpen ? (
        <div className="mb-3 shrink-0 rounded-lg border border-[#D5DADF] bg-[#F4F5F7] p-3">
          <p className="mb-2 text-[13px] font-medium">{tPhysio("packageAssignStartTitle")}</p>
          <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>{tPhysio("packageAssignStartHint")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <DatePicker
              label={tPhysio("packageAssignStartDate")}
              value={startDate}
              onChange={setStartDate}
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
        </div>
      ) : null}
      <div className="grid h-full min-h-0 flex-1 grid-rows-1 gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
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
                      {isReplaceableQuotaLine(b.procedureCode, b.procedureName) ? (
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
            {extraGroups.map(([group, items]) => {
              const deptOpen = openDepts.has(group);
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
            })}
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
            };
            const lanes: Lane[] = [];
            const claimedExtra = new Set<string>();
            const usedPending = new Set<string>();
            const usedPaid = new Set<string>();
            const takeExtra = (code: string, paramsLabel: string) => {
              const hit = extraDraft.find(
                (row) =>
                  !claimedExtra.has(row.key) &&
                  row.procedureCode === code &&
                  row.paramsLabel === paramsLabel,
              );
              if (hit) claimedExtra.add(hit.key);
              return hit;
            };
            const takePending = (code: string) =>
              extraPending.filter((row) => {
                if (row.procedureCode !== code || usedPending.has(row.id)) return false;
                usedPending.add(row.id);
                return true;
              });
            const takePaid = (code: string) =>
              paidExtras.filter((row) => {
                if (row.procedureCode !== code || usedPaid.has(row.id)) return false;
                usedPaid.add(row.id);
                return true;
              });
            const pushLane = (
              code: string,
              name: string,
              paramsLabel: string,
              params: string[],
              assigned: PackageAssignedAgg | undefined,
              pkgDraft: DraftLine | undefined,
              pkgQty: number,
              pkgLocked: boolean,
            ) => {
              const extra = takeExtra(code, paramsLabel);
              const pending = takePending(code);
              const paid = takePaid(code);
              const unpaidQty = (extra?.qty ?? 0) + pending.length;
              if (pkgQty < 1 && unpaidQty < 1 && paid.length < 1 && !assigned) return;
              const unit = extra?.amountNet || pending[0]?.amountNet || unitOf(code);
              lanes.push({
                key: assigned ? assignedKey(assigned) : pkgDraft?.key ?? `x:${code}:${paramsLabel}`,
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
              });
            };
            for (const row of assigned) {
              const key = assignedKey(row);
              if (pendingCancel.has(key)) continue;
              const pkgDraft = draft.find((d) => draftMatchesAssigned(d, row, menuQuotaForAssigned(row)));
              const cut = pendingCut[key] ?? 0;
              pushLane(
                row.procedureCode,
                row.procedureName,
                row.paramsLabel ?? "",
                paramLinesOf(row.paramsLabel, row.paramsLines),
                row,
                pkgDraft,
                Math.max(0, row.qty - cut) + (pkgDraft?.qty ?? 0),
                row.locked,
              );
            }
            for (const line of leftoverDraft) {
              pushLane(
                line.procedureCode,
                line.procedureName,
                line.paramsLabel,
                paramLinesOf(line.paramsLabel),
                undefined,
                line,
                line.qty,
                false,
              );
            }
            for (const row of extraDraft) {
              if (claimedExtra.has(row.key)) continue;
              pushLane(
                row.procedureCode,
                row.procedureName,
                row.paramsLabel,
                paramLinesOf(row.paramsLabel),
                undefined,
                undefined,
                0,
                false,
              );
            }
            for (const row of [...extraPending, ...paidExtras]) {
              if (usedPending.has(row.id) || usedPaid.has(row.id)) continue;
              if (lanes.some((lane) => lane.code === row.procedureCode)) continue;
              pushLane(row.procedureCode, row.procedureName, "", [], undefined, undefined, 0, false);
            }
            if (lanes.length === 0) {
              return <p className={TEXT_MUTED_CLASS}>{labels.emptyRight}</p>;
            }
            const stepper = (
              qty: number,
              onMinus: () => void,
              onPlus: () => void,
              plusDisabled: boolean,
            ) => (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  disabled={busy || qty < 1}
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
                  const quota = lane.assigned
                    ? lane.assigned.packageQuotaCode || lane.assigned.procedureCode
                    : lane.pkgDraft?.burnPoolCode || lane.code;
                  const rem = draftRemaining.get(quota) ?? 0;
                  const saxlaNo = lane.pkgDraft
                    ? saxlaOrderByDraftKey.get(lane.pkgDraft.key)
                    : undefined;
                  return (
                    <li
                      key={lane.key}
                      className={`${CARD_CONTAINER_CLASS} px-3 py-2 text-[13px] ${
                        lane.pkgLocked ? "opacity-80" : ""
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
                          {lane.pkgLocked ? (
                            <span className="tabular-nums">{lane.pkgQty}</span>
                          ) : (
                            stepper(
                              lane.pkgQty,
                              () => {
                                if (lane.assigned) bumpMinusOne(lane.assigned);
                                else if (lane.pkgDraft) bumpLeftoverMinus(lane.pkgDraft);
                              },
                              () => {
                                if (lane.assigned) bumpPlusOne(lane.assigned);
                                else if (lane.pkgDraft) bumpLeftoverPlus(lane.pkgDraft);
                              },
                              rem < 1 &&
                                !(
                                  lane.assigned &&
                                  (pendingCut[assignedKey(lane.assigned)] ?? 0) > 0
                                ),
                            )
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
                            () => extraMinus(lane.code, lane.paramsLabel),
                            () => extraPlus(lane.code, lane.name, lane.paramsLabel),
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
                  disabled={busy || !replaceFrom || !replaceTo || replaceReason.trim().length < 2}
                  onClick={() => void submitReplace()}
                >
                  {tPhysio("replaceBaths")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
  function answerCheckout(place: boolean) {
    const names = checkoutAsk ?? [];
    setCheckoutAsk(null);
    if (!place || names.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutMorning: true, lines: [] }),
        });
        const body = await res.json().catch(() => ({}));
        const payload = body.data ?? body;
        const left = Array.isArray(payload.misses) ? payload.misses : [];
        const leftNames = [
          ...new Set(
            left
              .map((row: { procedureName?: string; procedureCode?: string }) => row.procedureName || row.procedureCode)
              .filter((name: string | undefined): name is string => Boolean(name)),
          ),
        ].join(", ");
        if (!res.ok) {
          showApiError({ error: assignSaveMessage(body) }, tc("saveFailed"));
        } else if (leftNames) {
          showApiError({ error: tPhysio("packageAssignCheckoutNoonLeft", { names: leftNames }) });
        }
        onSaved();
      } finally {
        setBusy(false);
        onClose();
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
      {checkout}
    </>
  );
  if (typeof document === "undefined") return tree;
  return createPortal(tree, document.body);
}
