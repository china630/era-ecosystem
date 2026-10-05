"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  showApiError,
} from "@era/satellite-kit/ui";
import { ArrowLeftRight, Minus, Plus, Trash2 } from "lucide-react";
import {
  PhysioSiteChips,
  type PhysioCatalogListItem,
  type PhysioCatalogSite,
  type PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";
import { buildPhysioChipsLabels } from "@/components/physio/physio-chips-labels";
import { inferPhysioTypeGate, siteCodeForNaftalanFill } from "@/domain/physio/physio-type-gate";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { packageAssignBlockText } from "@/lib/package-assign-block";

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
  /** False for intake labs/exams — read-only in W2; hidden from assign menu in W1. */
  assignable?: boolean;
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

function paramsLabelFromPhysio(
  p: PhysioChipsValue,
  catalog: PhysioCatalogSite[],
): string {
  const parts: string[] = [];
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const siteNames = (p.hideSitePicker ? [] : p.siteIds ?? [])
    .map((id) => byId.get(id)?.titleEn || byId.get(id)?.titleRu || byId.get(id)?.code)
    .filter(Boolean);
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (p.siteApplyMode && !p.hideSitePicker) parts.push(p.siteApplyMode);
  if (p.physioFields && typeof p.physioFields === "object") {
    for (const [k, v] of Object.entries(p.physioFields)) {
      if (v != null && String(v).trim()) parts.push(`${k}: ${String(v)}`);
    }
  }
  if (p.note?.trim()) parts.push(p.note.trim());
  return parts.join(" · ");
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

function draftMatchesAssigned(d: DraftLine, row: PackageAssignedAgg): boolean {
  const quota = d.burnPoolCode || d.procedureCode;
  const rowQuota = row.packageQuotaCode || row.procedureCode;
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
  const { auth } = useClinicAuth();
  const canOutOfPackage =
    auth?.permissions?.includes(CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER) === true;

  const [balances, setBalances] = useState<PackageBalanceRow[]>([]);
  const [assigned, setAssigned] = useState<PackageAssignedAgg[]>([]);
  const [poolEligible, setPoolEligible] = useState<Record<string, PoolEligibleSku[]>>({});
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [formCode, setFormCode] = useState<string | null>(null);
  const [formBurnPool, setFormBurnPool] = useState<string | null>(null);
  const [formQty, setFormQty] = useState(1);
  const [formPhysio, setFormPhysio] = useState<PhysioChipsValue>(EMPTY_PHYSIO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [softWarn, setSoftWarn] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<PackageBlockReason | null>(null);
  const [formLane, setFormLane] = useState<"package" | "extra" | null>(null);
  const [extraDraft, setExtraDraft] = useState<ExtraDraftLine[]>([]);
  const [extraPrices, setExtraPrices] = useState<Record<string, number>>({});
  const [extraPending, setExtraPending] = useState<
    Array<{ id: string; procedureName: string; amountNet: number }>
  >([]);

  const [catalog, setCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [allCodes, setAllCodes] = useState<
    Array<{ value: string; label: string; departmentName: string }>
  >([]);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [replaceQty, setReplaceQty] = useState(1);
  const [replaceBatchId, setReplaceBatchId] = useState<string | null>(null);
  const [packagePin, setPackagePin] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Set<string>>(new Set());
  const [pendingCut, setPendingCut] = useState<Record<string, number>>({});

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
      setError(code && !msg.includes(code) ? `${msg} (${code})` : msg);
      return;
    }
    const payload = d.data ?? d;
    setBalances(payload.balances ?? []);
    setAssigned(payload.assigned ?? []);
    setPoolEligible(payload.poolEligible ?? {});
    const code = typeof payload.packageCode === "string" ? payload.packageCode : null;
    const ver =
      typeof payload.packageVersion === "number" ? payload.packageVersion : null;
    setPackagePin(code ? (ver != null ? `${code} · v${ver}` : code) : null);
    const known: PackageBlockReason[] = [
      "NO_PROGRAM",
      "NO_PROGRAM_CODE",
      "NO_ANAMNESIS",
      "NO_COMPLAINT",
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
    if (blockText) setError(blockText);
    else if (payload.softWarnDay1) setSoftWarn(String(payload.softWarnDay1));
  }, [episodeId, locale, tPhysio]);

  useEffect(() => {
    if (!open) return;
    setDraft([]);
    setExtraDraft([]);
    setFormLane(null);
    setPendingCancel(new Set());
    setPendingCut({});
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
            pending.map((row: { id: string; procedureName?: string; amountNet?: number }) => ({
              id: row.id,
              procedureName: row.procedureName || row.id,
              amountNet: Number(row.amountNet || 0),
            })),
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

  const draftRemaining = useMemo(() => {
    const map = new Map(balances.map((b) => [b.procedureCode, b.remaining]));
    for (const d of draft) {
      const quota = d.burnPoolCode || d.procedureCode;
      map.set(quota, Math.max(0, (map.get(quota) ?? 0) - d.qty));
    }
    for (const row of assigned) {
      if (row.locked) continue;
      const key = assignedKey(row);
      const quota = row.packageQuotaCode || row.procedureCode;
      const cut = pendingCancel.has(key) ? row.qty : pendingCut[key] ?? 0;
      if (cut > 0) map.set(quota, (map.get(quota) ?? 0) + cut);
    }
    return map;
  }, [balances, draft, assigned, pendingCancel, pendingCut]);

  const hasPendingAdjust =
    pendingCancel.size > 0 || Object.values(pendingCut).some((n) => n > 0);
  const clinicalLock =
    blockReason === "NO_ANAMNESIS" ||
    blockReason === "NO_COMPLAINT" ||
    blockReason === "NO_CARE_TEAM";
  const extraDraftTotal = extraDraft.reduce((sum, row) => sum + row.amountNet * row.qty, 0);
  const extraPendingTotal = extraPending.reduce((sum, row) => sum + row.amountNet, 0);
  const canSavePackage =
    !blockReason && (draft.length > 0 || hasPendingAdjust || (formLane === "package" && Boolean(formCode)));
  const canSaveExtras = !clinicalLock && (extraDraft.length > 0 || formLane === "extra");
  const canSave = !busy && (canSavePackage || canSaveExtras);

  const leftoverDraft = useMemo(() => {
    const used = new Set<string>();
    for (const row of assigned) {
      const key = assignedKey(row);
      if (pendingCancel.has(key)) continue;
      const match = draft.find(
        (d) => !used.has(d.key) && draftMatchesAssigned(d, row),
      );
      if (match) used.add(match.key);
    }
    return draft.filter((d) => !used.has(d.key));
  }, [assigned, draft, pendingCancel]);

  const packageCodeOptions = useMemo(
    () =>
      balances
        .filter((b) => !b.isPool && !b.isQuotaAlias && !b.needsSkuPicker)
        .map((b) => ({
          value: b.procedureCode,
          label: b.procedureName || b.procedureCode,
        })),
    [balances],
  );

  const replaceToOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    for (const row of packageCodeOptions) map.set(row.value, row);
    for (const list of Object.values(poolEligible)) {
      for (const sku of list) map.set(sku.code, { value: sku.code, label: sku.name || sku.code });
    }
    return [...map.values()];
  }, [packageCodeOptions, poolEligible]);

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

  function quotaForCode(code: string): { rem: number; burnPool: string | null } {
    if (balances.some((b) => b.procedureCode === code && !b.isPool && !b.isQuotaAlias)) {
      return { rem: draftRemaining.get(code) ?? 0, burnPool: null };
    }
    for (const [pool, skus] of Object.entries(poolEligible)) {
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
      paramsLabel: paramsLabelFromPhysio({ ...formPhysio, siteIds }, catalog),
    };
  }

  function formDraftLine(): Omit<DraftLine, "key"> | null {
    if (!formCode || !formQuotaCode) return null;
    const quota = formBurnPool
      ? { rem: draftRemaining.get(formBurnPool) ?? 0, burnPool: formBurnPool }
      : quotaForCode(formCode);
    const qty = Math.min(formQty, quota.rem);
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
    const unit = extraPrices[formCode] ?? 0;
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
        paramsLabel: paramsLabelFromPhysio({ ...formPhysio, siteIds: occupancy }, catalog),
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
    const unit = extraPrices[code] ?? 0;
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

  function openCatalogLine(code: string, name: string) {
    setFormLane("package");
    setFormBurnPool(null);
    setFormCode(code);
    setFormQty(1);
    setFormPhysio(gateToPhysio(code, name));
  }

  function addDraft() {
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
    const paid = formCode ? Math.max(0, formQty - quota.rem) : 0;
    if (line) pushDraft(line);
    if (paid > 0 && formCode) pushPaid(formCode, formName, paid, formDetail());
    if (line || paid > 0) closeForm();
  }

  function fillAll(code: string) {
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

  async function save() {
    let extras = extraDraft;
    let lines = draft;
    if (formLane === "extra" && formCode) {
      const unit = extraPrices[formCode] ?? 0;
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
          paramsLabel: paramsLabelFromPhysio(formPhysio, catalog),
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
      const paid = formCode ? Math.max(0, formQty - quota.rem) : 0;
      if (paid > 0 && formCode) {
        const detail = formDetail();
        const unit = extraPrices[formCode] ?? 0;
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
    if (lines.length === 0 && !hasAdjust && extras.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
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
          showApiError(d, tc("failed"));
          return;
        }
      }

      if (lines.length > 0 && !blockReason) {
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: lines.map((d) => ({
              procedureCode: d.procedureCode,
              qty: d.qty,
              note: d.note || null,
              physioFields: d.physioFields ?? null,
              siteIds: d.siteIds ?? [],
              siteApplyMode: d.siteApplyMode ?? null,
              siteLaterality: d.siteLaterality ?? {},
              burnPoolCode: d.burnPoolCode ?? null,
            })),
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          const code = typeof d?.code === "string" ? d.code : null;
          const msg =
            code === "PLACE_FAILED"
              ? tPhysio("packageAssignPlaceFailed")
              : typeof d?.error === "string" && d.error.trim()
                ? d.error
                : tc("saveFailed");
          showApiError(
            {
              error:
                code && code !== "PLACE_FAILED" && !msg.includes(code)
                  ? `${msg} (${code})`
                  : msg,
            },
          );
          return;
        }
        const payload = d.data ?? d;
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
                  : typeof extraBody?.error === "string"
                    ? extraBody.error
                    : tc("saveFailed"),
            },
          );
          return;
        }
      }
      setDraft([]);
      setExtraDraft([]);
      setPendingCancel(new Set());
      setPendingCut({});
      closeForm();
      onSaved();
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
    const quota = row.packageQuotaCode || row.procedureCode;
    const rem = draftRemaining.get(quota) ?? 0;
    if (rem < 1) {
      const fromDraft = draft.find((d) => draftMatchesAssigned(d, row));
      pushPaid(row.procedureCode, row.procedureName, 1, {
        note: fromDraft?.note ?? row.note ?? "",
        physioFields: fromDraft?.physioFields ?? row.physioFields ?? null,
        siteIds: fromDraft?.siteIds ?? row.siteIds ?? [],
        siteApplyMode: fromDraft?.siteApplyMode ?? row.siteApplyMode ?? null,
        siteLaterality: fromDraft?.siteLaterality ?? row.siteLaterality,
        paramsLabel: fromDraft?.paramsLabel ?? row.paramsLabel ?? "",
      });
      return;
    }
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
    if (peelPaid(row.procedureCode, row.paramsLabel ?? "")) return;
    if (row.qty < 1) return;
    const key = assignedKey(row);
    const matching = draft.find((d) => draftMatchesAssigned(d, row));
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
    setDraft((prev) => prev.filter((d) => !draftMatchesAssigned(d, row)));
  }

  function openReplace(row?: PackageAssignedAgg) {
    setReplaceFrom(row?.procedureCode ?? assigned[0]?.procedureCode ?? "");
    setReplaceBatchId(null);
    setReplaceQty(1);
    setReplaceTo("");
    setReplaceOpen(true);
  }

  async function submitReplace() {
    if (!replaceFrom || !replaceTo || replaceQty < 1) return;
    const toInPackage =
      balances.some(
        (b) =>
          !b.isPool &&
          !b.isQuotaAlias &&
          !b.needsSkuPicker &&
          b.procedureCode === replaceTo,
      ) ||
      Object.values(poolEligible).some((list) => list.some((s) => s.code === replaceTo));
    if (!toInPackage && !canOutOfPackage) {
      showApiError({ error: tPhysio("packageAssignOutOfPackage") });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/package-assign/replace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromCode: replaceFrom,
            toCode: replaceTo,
            qty: replaceQty,
            assignBatchId: replaceBatchId,
          }),
        },
      );
      const d = await res.json();
      if (!res.ok) {
        showApiError(d, tc("failed"));
        return;
      }
      setReplaceOpen(false);
      await load();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title={labels.title}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidthClass="max-w-6xl w-full max-h-[90vh]"
      bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={onClose}
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
      <div className="grid h-[min(82vh,48rem)] min-h-0 gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <h4 className="text-sm font-medium">{tPhysio("packageBalanceTitle")}</h4>
          {balances.filter((b) => b.assignable !== false).length === 0 ? (
            <p className={TEXT_MUTED_CLASS}>{labels.emptyLeft}</p>
          ) : (
            <ul className="space-y-1">
              {balances
                .filter((b) => b.assignable !== false)
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
            {extraGroups.map(([group, items]) => (
              <div key={group} className="mb-3">
                <div className="mb-1 text-[12px] font-semibold text-[#1F4E79]">{group}</div>
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
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">{tPhysio("assignedReceiptTitle")}</h4>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {assigned.filter((row) => !pendingCancel.has(assignedKey(row))).length ===
            0 &&
          leftoverDraft.length === 0 &&
          pendingCancel.size === 0 ? (
            <p className={TEXT_MUTED_CLASS}>{labels.emptyRight}</p>
          ) : (
            <ul className="space-y-2">
              {(() => {
                const claimed = new Set<string>();
                return assigned.map((row, idx) => {
                const key = assignedKey(row);
                if (pendingCancel.has(key)) return null;
                const extra = draft.find(
                  (d) => !claimed.has(d.key) && draftMatchesAssigned(d, row),
                );
                if (extra) claimed.add(extra.key);
                const cut = pendingCut[key] ?? 0;
                const liveQty = Math.max(0, row.qty - cut);
                const totalQty = liveQty + (extra?.qty ?? 0);
                const lockedLabel = row.locked
                  ? row.statusKind === "consumed"
                    ? labels.consumedLocked
                    : labels.checkedInLocked ?? "Checked in"
                  : "";
                const headQty = [
                  extra?.qty
                    ? `(+${extra.qty} ${tPhysio("packageAssignUnsaved")})`
                    : "",
                  cut > 0 ? `(−${cut} ${tPhysio("packageAssignUnsaved")})` : "",
                  lockedLabel ? `(${lockedLabel})` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    key={`${key}-${idx}`}
                    className={`${CARD_CONTAINER_CLASS} flex items-start justify-between gap-2 px-3 py-2 text-[13px] ${
                      row.locked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {row.procedureName} {headQty}
                        {row.locked ? ` · ${tPhysio("fromPackage")}` : ""}
                      </div>
                      {paramLinesOf(row.paramsLabel, row.paramsLines).map((line) => (
                        <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                          {line}
                        </p>
                      ))}
                    </div>
                    {!row.locked ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                          disabled={busy || totalQty < 1}
                          onClick={() => bumpMinusOne(row)}
                          title={labels.qtyDown ?? "−1"}
                          aria-label={labels.qtyDown ?? "−1"}
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 text-center tabular-nums">{totalQty}</span>
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                          disabled={busy}
                          onClick={() => bumpPlusOne(row)}
                          title={labels.qtyUp ?? "+1"}
                          aria-label={labels.qtyUp ?? "+1"}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className={`w-28 text-right text-[12px] ${TEXT_MUTED_CLASS}`}>
                          {tPhysio("fromPackage")}
                        </span>
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                          disabled={busy}
                          onClick={() => openReplace(row)}
                          title={labels.replace ?? "Replace"}
                          aria-label={labels.replace ?? "Replace"}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                          disabled={busy}
                          onClick={() => markRemoveAssigned(row)}
                          title={labels.delete}
                          aria-label={labels.delete}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className={`w-28 shrink-0 text-right text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {tPhysio("fromPackage")}
                      </span>
                    )}
                  </li>
                );
                });
              })()}
              {leftoverDraft.map((d) => (
                <li
                  key={d.key}
                  className={`${CARD_CONTAINER_CLASS} flex items-start justify-between gap-2 border-dashed px-3 py-2 text-[13px]`}
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {d.procedureName}
                    </div>
                    {paramLinesOf(d.paramsLabel).map((line) => (
                      <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                      disabled={busy || d.qty < 1}
                      onClick={() => bumpLeftoverMinus(d)}
                      title={labels.qtyDown ?? "−1"}
                      aria-label={labels.qtyDown ?? "−1"}
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="w-6 text-center tabular-nums">{d.qty}</span>
                    <button
                      type="button"
                      className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                      disabled={busy}
                      onClick={() => bumpLeftoverPlus(d)}
                      title={labels.qtyUp ?? "+1"}
                      aria-label={labels.qtyUp ?? "+1"}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className={`w-28 text-right text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {tPhysio("fromPackage")}
                    </span>
                    <span className="inline-flex h-6 w-6" aria-hidden />
                    <button
                      type="button"
                      className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                      onClick={() => setDraft((prev) => prev.filter((x) => x.key !== d.key))}
                      title={labels.delete}
                      aria-label={labels.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {extraPending.map((row) => (
            <div
              key={row.id}
              className={`${CARD_CONTAINER_CLASS} flex items-center justify-between gap-2 px-3 py-2 text-[13px]`}
            >
              <span className="min-w-0 truncate font-medium">{row.procedureName}</span>
              <span className="w-28 shrink-0 text-right text-[12px]">{row.amountNet.toFixed(2)} AZN</span>
            </div>
          ))}
          {extraDraft.map((row) => (
            <div
              key={row.key}
              className={`${CARD_CONTAINER_CLASS} flex items-start justify-between gap-2 px-3 py-2 text-[13px]`}
            >
              <div className="min-w-0">
                <div className="font-medium">{row.procedureName}</div>
                {paramLinesOf(row.paramsLabel).map((line) => (
                  <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                    {line}
                  </p>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  disabled={busy || row.qty < 1}
                  onClick={() =>
                    setExtraDraft((prev) =>
                      prev.flatMap((item) => {
                        if (item.key !== row.key) return [item];
                        if (item.qty <= 1) return [];
                        return [{ ...item, qty: item.qty - 1 }];
                      }),
                    )
                  }
                  aria-label={labels.qtyDown ?? "−1"}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="w-6 text-center tabular-nums">{row.qty}</span>
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  disabled={busy}
                  onClick={() =>
                    setExtraDraft((prev) =>
                      prev.map((item) =>
                        item.key === row.key ? { ...item, qty: item.qty + 1 } : item,
                      ),
                    )
                  }
                  aria-label={labels.qtyUp ?? "+1"}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="w-28 text-right text-[12px] tabular-nums">
                  {row.amountNet.toFixed(2)}
                  <span className={`block ${TEXT_MUTED_CLASS}`}>
                    {(row.amountNet * row.qty).toFixed(2)}
                  </span>
                </span>
                <span className="inline-flex h-6 w-6" aria-hidden />
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                  onClick={() => setExtraDraft((prev) => prev.filter((x) => x.key !== row.key))}
                  aria-label={labels.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
          </div>
          <p className="border-t border-slate-200 pt-2 text-right text-base font-semibold">
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
                      max={
                        formLane === "extra"
                          ? 40
                          : Math.max(1, draftRemaining.get(formQuotaCode ?? formCode) ?? 1)
                      }
                      value={formQty}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 1;
                        const cap =
                          formLane === "extra"
                            ? 40
                            : Math.max(1, draftRemaining.get(formQuotaCode ?? formCode) ?? 1);
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
                  {tPhysio("price")}:{" "}
                  {Number.isFinite(extraPrices[formCode]) && extraPrices[formCode] > 0
                    ? `${extraPrices[formCode].toFixed(2)} AZN`
                    : "—"}
                  {" · "}
                  {tPhysio("extrasDraftTotal")}:{" "}
                  {(
                    (Number.isFinite(extraPrices[formCode]) ? extraPrices[formCode] : 0) *
                    Math.max(1, formQty)
                  ).toFixed(2)}{" "}
                  AZN
                </p>
              ) : null}
              {formCode ? (
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
                    />
                  </div>
                </>
              ) : (
                <p className={`mb-3 text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {labels.pickPoolSku ?? tPhysio("packageAssignPoolHint")}
                </p>
              )}
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
              <h4 className="mb-2 font-medium">{labels.replace ?? "Replace"}</h4>
              <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>
                {tPhysio("packageAssignOutOfPackage")}
              </p>
              <div className="mb-2 max-w-xs">
                <CatalogField
                  kind="SEARCHABLE"
                  label={labels.replaceFrom ?? "From"}
                  value={replaceFrom}
                  onChange={(v) => setReplaceFrom(String(v ?? ""))}
                  options={packageCodeOptions}
                  widthPreset="select"
                />
              </div>
              <div className="mb-2 max-w-xs">
                <CatalogField
                  kind="SEARCHABLE"
                  label={labels.replaceTo ?? "To"}
                  value={replaceTo}
                  onChange={(v) => setReplaceTo(String(v ?? ""))}
                  options={replaceToOptions}
                  widthPreset="select"
                />
              </div>
              <label className="mb-3 block text-[12px]">
                {labels.qty}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1 w-[6ch]`}
                  type="number"
                  min={1}
                  value={replaceQty}
                  onChange={(e) => setReplaceQty(Number(e.target.value) || 1)}
                />
              </label>
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
                  disabled={busy || !replaceFrom || !replaceTo}
                  onClick={() => void submitReplace()}
                >
                  {labels.replaceSubmit ?? "Replace"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
