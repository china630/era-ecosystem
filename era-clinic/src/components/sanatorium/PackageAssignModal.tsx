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
};

type PoolEligibleSku = { code: string; name: string };

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
  const [blockReason, setBlockReason] = useState<"NO_PROGRAM" | "NO_PROGRAM_CODE" | null>(
    null,
  );

  const [catalog, setCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [allCodes, setAllCodes] = useState<Array<{ value: string; label: string }>>([]);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [replaceQty, setReplaceQty] = useState(1);
  const [replaceBatchId, setReplaceBatchId] = useState<string | null>(null);
  const [packagePin, setPackagePin] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Set<string>>(new Set());
  const [pendingCut, setPendingCut] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`);
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
    const block =
      payload.blockReason === "NO_PROGRAM" || payload.blockReason === "NO_PROGRAM_CODE"
        ? (payload.blockReason as "NO_PROGRAM" | "NO_PROGRAM_CODE")
        : null;
    setBlockReason(block);
    if (block === "NO_PROGRAM_CODE") {
      setError(tPhysio("packageAssignNoProgramCode"));
    } else if (block === "NO_PROGRAM") {
      setError(tPhysio("packageAssignNoProgram"));
    } else if (payload.softWarnDay1) {
      setSoftWarn(String(payload.softWarnDay1));
    }
  }, [episodeId, tPhysio]);

  useEffect(() => {
    if (!open) return;
    setDraft([]);
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
        const [catRes, typesRes] = await Promise.all([
          fetch("/api/physio-catalog"),
          fetch("/api/procedure-types"),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          setCatalog((data.sites ?? data.data?.sites ?? []) as PhysioCatalogSite[]);
          setPrograms((data.programs ?? data.data?.programs ?? []) as PhysioCatalogListItem[]);
          setSubstances(
            (data.substances ?? data.data?.substances ?? []) as PhysioCatalogListItem[],
          );
        }
        if (typesRes.ok) {
          const data = await typesRes.json();
          const rows = (data.data ?? data.items ?? data) as Array<{
            code: string;
            name: string;
          }>;
          if (Array.isArray(rows)) {
            setAllCodes(
              rows.map((r) => ({ value: r.code, label: r.name || r.code })),
            );
          }
        }
      } catch {
        /* optional catalogs */
      }
    })();
  }, [open, load]);

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
  const canSave =
    !busy &&
    !blockReason &&
    (draft.length > 0 || hasPendingAdjust || Boolean(formCode));

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
    setFormCode(null);
    setFormBurnPool(null);
    setFormPhysio(EMPTY_PHYSIO);
  }

  function openForm(code: string, fillAllQty = false) {
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

  function formDraftLine(): Omit<DraftLine, "key"> | null {
    if (!formCode || !formQuotaCode) return null;
    const rem = draftRemaining.get(formQuotaCode) ?? 0;
    const qty = Math.min(formQty, rem);
    if (qty < 1) return null;
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
    return {
      procedureCode: formCode,
      procedureName: formName,
      qty,
      note: formPhysio.note ?? "",
      physioFields: {
        ...formPhysio.physioFields,
        ...(formQty <= 1 ? { bathSequence: null } : {}),
      } as Record<string, unknown>,
      siteIds: occupancy,
      siteApplyMode: formPhysio.hideSitePicker ? "TOGETHER" : formPhysio.siteApplyMode,
      siteLaterality: formPhysio.siteLaterality,
      paramsLabel: paramsLabelFromPhysio(formPhysio, catalog),
      fingerprint: fingerprintFromPhysio(formPhysio),
      burnPoolCode: formBurnPool,
    };
  }

  function addDraft() {
    const line = formDraftLine();
    if (!line) return;
    pushDraft(line);
    closeForm();
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
    const flushed = formDraftLine();
    const lines = flushed ? mergeDraft(draft, flushed) : draft;
    const cancelKeys = pendingCancel;
    const cuts = pendingCut;
    const hasAdjust =
      cancelKeys.size > 0 || Object.values(cuts).some((n) => n > 0);
    if (lines.length === 0 && !hasAdjust) {
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
          setError(d.error ?? "Adjust failed");
          return;
        }
      }

      if (lines.length > 0) {
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
                : "Save failed";
          setError(
            code && code !== "PLACE_FAILED" && !msg.includes(code)
              ? `${msg} (${code})`
              : msg,
          );
          return;
        }
        const payload = d.data ?? d;
        if (payload.softWarn) setSoftWarn(String(payload.softWarn));
      }
      setDraft([]);
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
    if (rem < 1) return;
    pushDraft({
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      qty: 1,
      note: "",
      paramsLabel: row.paramsLabel ?? "",
      fingerprint: `params:${row.paramsLabel ?? ""}`,
      burnPoolCode: quota !== row.procedureCode ? quota : null,
    });
  }

  function bumpMinusOne(row: PackageAssignedAgg) {
    if (row.locked || row.qty < 1) return;
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
    if (rem < 1) return;
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
      setError(
        "Out-of-package replace requires FO manager (creates PENDING_PAY paid extra).",
      );
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
        setError(d.error ?? "Replace failed");
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
      maxWidthClass="max-w-4xl w-full min-h-[min(85vh,52rem)] max-h-[90vh]"
      overlayZClass="z-[210]"
      bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto"
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
      <div className="relative grid min-h-[min(55vh,28rem)] flex-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{labels.leftMenu}</h4>
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
                          ? " · pool — pick procedure"
                          : b.isQuotaAlias
                            ? " · pick gender bath"
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
                        title={picker ? labels.pickPoolSku ?? "Pick procedure" : undefined}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">{labels.rightAssigned}</h4>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || assigned.every((a) => a.locked)}
              onClick={() => openReplace()}
            >
              {labels.replace ?? "Replace"}
            </button>
          </div>
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
                  `×${totalQty}`,
                  extra?.qty ? `(+${extra.qty} draft)` : "",
                  cut > 0 ? `(−${cut} draft)` : "",
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
                      </div>
                      {paramLinesOf(row.paramsLabel, row.paramsLines).map((line) => (
                        <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                          {line}
                        </p>
                      ))}
                    </div>
                    {!row.locked ? (
                      <div className="flex shrink-0 items-center gap-0.5">
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
                    ) : null}
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
                      {d.procedureName} ×{d.qty} (draft)
                    </div>
                    {paramLinesOf(d.paramsLabel).map((line) => (
                      <p key={line} className={`text-[12px] leading-snug ${TEXT_MUTED_CLASS}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                      disabled={busy || (draftRemaining.get(d.burnPoolCode || d.procedureCode) ?? 0) < 1}
                      onClick={() => bumpLeftoverPlus(d)}
                      title={labels.qtyUp ?? "+1"}
                      aria-label={labels.qtyUp ?? "+1"}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
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
        </div>

          {formBurnPool || formCode ? (
            <div className="absolute top-0 right-0 bottom-0 z-10 mt-0 max-h-full w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg md:w-[calc(50%-0.5rem)]">
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
                      max={draftRemaining.get(formQuotaCode ?? formCode) ?? 1}
                      value={formQty}
                      onChange={(e) => {
                        const n = Number(e.target.value) || 1;
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
                  {labels.pickPoolSku ?? "Select a real procedure from the pool."}
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
            <div className="absolute top-0 right-0 bottom-0 z-20 mt-0 max-h-full w-full overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/90 p-3 shadow-lg md:w-[calc(50%-0.5rem)]">
              <h4 className="mb-2 font-medium">{labels.replace ?? "Replace"}</h4>
              <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>
                Out-of-package target → PENDING_PAY (manager only).
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
                  options={allCodes.length ? allCodes : packageCodeOptions}
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
    </ModalShell>
  );
}
