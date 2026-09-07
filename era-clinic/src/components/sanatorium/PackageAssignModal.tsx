"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  MODAL_INPUT_CLASS,
  CARD_CONTAINER_CLASS,
  CatalogField,
} from "@era/satellite-kit/ui";
import {
  PhysioSiteChips,
  type PhysioCatalogListItem,
  type PhysioCatalogSite,
  type PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";
import { buildPhysioChipsLabels } from "@/components/physio/physio-chips-labels";
import { inferPhysioTypeGate } from "@/domain/physio/physio-type-gate";
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
};

export type PackageAssignedAgg = {
  assignBatchId: string | null;
  procedureCode: string;
  procedureName: string;
  qty: number;
  statusKind: "active" | "consumed";
  locked: boolean;
  paramsLabel?: string;
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
    checkedInLocked?: string;
    pickPoolSku?: string;
  };
};

const EMPTY_PHYSIO: PhysioChipsValue = {
  needsSite: false,
  physioOrderFields: [],
  allowedSiteCodes: [],
  forceSiteTogether: false,
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
  const siteNames = (p.siteIds ?? [])
    .map((id) => byId.get(id)?.titleEn || byId.get(id)?.titleRu || byId.get(id)?.code)
    .filter(Boolean);
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (p.siteApplyMode) parts.push(p.siteApplyMode);
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
    sitesHintKey: gate.sitesHintKey,
    siteApplyMode: gate.forceSiteTogether ? "TOGETHER" : null,
    note: note || null,
  };
}

/** CLI-57 package planning modal — two columns + form overlay; one Save commit. */
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
    auth?.permissions?.includes(CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER) === true ||
    auth?.role === "CLINIC_ADMIN";

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

  const [catalog, setCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [allCodes, setAllCodes] = useState<Array<{ value: string; label: string }>>([]);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [replaceQty, setReplaceQty] = useState(1);
  const [replaceBatchId, setReplaceBatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`);
    if (!res.ok) {
      setError("Failed to load package assign");
      return;
    }
    const d = await res.json();
    const payload = d.data ?? d;
    setBalances(payload.balances ?? []);
    setAssigned(payload.assigned ?? []);
    setPoolEligible(payload.poolEligible ?? {});
  }, [episodeId]);

  useEffect(() => {
    if (!open) return;
    setDraft([]);
    setFormCode(null);
    setFormBurnPool(null);
    setError(null);
    setSoftWarn(null);
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
    return map;
  }, [balances, draft]);

  const packageCodeOptions = useMemo(
    () =>
      balances
        .filter((b) => !b.isPool)
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

  function closeForm() {
    setFormCode(null);
    setFormBurnPool(null);
    setFormPhysio(EMPTY_PHYSIO);
  }

  function openForm(code: string, fillAllQty = false) {
    const bal = balances.find((b) => b.procedureCode === code);
    const rem = draftRemaining.get(code) ?? 0;
    if (bal?.isPool) {
      setFormBurnPool(code);
      setFormCode(null);
      setFormQty(fillAllQty ? Math.max(1, rem) : Math.min(1, Math.max(1, rem)) || 1);
      setFormPhysio(EMPTY_PHYSIO);
      return;
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
    setDraft((prev) => {
      const same = prev.find(
        (d) =>
          d.procedureCode === line.procedureCode &&
          (d.burnPoolCode ?? null) === (line.burnPoolCode ?? null) &&
          d.fingerprint === line.fingerprint,
      );
      if (same) {
        return prev.map((d) =>
          d.key === same.key ? { ...d, qty: d.qty + line.qty } : d,
        );
      }
      return [
        ...prev,
        {
          ...line,
          key: `${line.procedureCode}-${Date.now()}`,
        },
      ];
    });
  }

  function addDraft() {
    if (!formCode || !formQuotaCode) return;
    const rem = draftRemaining.get(formQuotaCode) ?? 0;
    const qty = Math.min(formQty, rem);
    if (qty < 1) return;
    const fp = fingerprintFromPhysio(formPhysio);
    pushDraft({
      procedureCode: formCode,
      procedureName: formName,
      qty,
      note: formPhysio.note ?? "",
      physioFields: formPhysio.physioFields as Record<string, unknown>,
      siteIds: formPhysio.siteIds,
      siteApplyMode: formPhysio.siteApplyMode,
      siteLaterality: formPhysio.siteLaterality,
      paramsLabel: paramsLabelFromPhysio(formPhysio, catalog),
      fingerprint: fp,
      burnPoolCode: formBurnPool,
    });
    closeForm();
  }

  function fillAll(code: string) {
    const bal = balances.find((b) => b.procedureCode === code);
    if (bal?.isPool) {
      openForm(code, true);
      return;
    }
    const rem = draftRemaining.get(code) ?? 0;
    if (rem < 1) return;
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
    if (draft.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: draft.map((d) => ({
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
        setError(d.error ?? "Save failed");
        return;
      }
      const payload = d.data ?? d;
      if (payload.softWarn) setSoftWarn(String(payload.softWarn));
      setDraft([]);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function decreaseAssigned(row: PackageAssignedAgg) {
    if (row.locked || row.qty < 1) return;
    setBusy(true);
    setError(null);
    try {
      const nextQty = row.qty - 1;
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/package-assign/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            procedureCode: row.procedureCode,
            assignBatchId: row.assignBatchId,
            ...(nextQty < 1
              ? { cancelAllActive: true }
              : { targetActiveQty: nextQty }),
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Adjust failed");
        return;
      }
      await load();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function removeAssigned(row: PackageAssignedAgg) {
    if (row.locked) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/package-assign/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            procedureCode: row.procedureCode,
            assignBatchId: row.assignBatchId,
            cancelAllActive: true,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Adjust failed");
        return;
      }
      await load();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  function openReplace(row?: PackageAssignedAgg) {
    setReplaceFrom(row?.procedureCode ?? assigned[0]?.procedureCode ?? "");
    setReplaceBatchId(row?.assignBatchId ?? null);
    setReplaceQty(1);
    setReplaceTo("");
    setReplaceOpen(true);
  }

  async function submitReplace() {
    if (!replaceFrom || !replaceTo || replaceQty < 1) return;
    const toInPackage =
      balances.some((b) => !b.isPool && b.procedureCode === replaceTo) ||
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
      maxWidthClass="max-w-4xl w-full min-h-[min(70vh,42rem)] max-h-[90vh]"
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
            disabled={busy || draft.length === 0}
            onClick={() => void save()}
          >
            {labels.save}
          </button>
        </div>
      }
    >
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      {softWarn ? (
        <p className="mb-2 text-[12px] text-amber-700">
          {labels.softWarnPrefix}: {softWarn}
        </p>
      ) : null}
      <div className="relative grid min-h-[min(55vh,28rem)] flex-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{labels.leftMenu}</h4>
          {balances.length === 0 ? (
            <p className={TEXT_MUTED_CLASS}>{labels.emptyLeft}</p>
          ) : (
            <ul className="space-y-1">
              {balances.map((b) => {
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
          {assigned.length === 0 && draft.length === 0 ? (
            <p className={TEXT_MUTED_CLASS}>{labels.emptyRight}</p>
          ) : (
            <ul className="space-y-2">
              {assigned.map((row, idx) => (
                <li
                  key={`${row.procedureCode}-${row.assignBatchId}-${idx}`}
                  className={`${CARD_CONTAINER_CLASS} flex items-center justify-between gap-2 px-3 py-2 text-[13px] ${
                    row.locked ? "opacity-60" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{row.procedureName}</div>
                    {row.paramsLabel ? (
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{row.paramsLabel}</p>
                    ) : null}
                    <p className={TEXT_MUTED_CLASS}>
                      ×{row.qty}
                      {row.locked
                        ? ` · ${row.statusKind === "consumed" ? labels.consumedLocked : labels.checkedInLocked ?? "Checked in"}`
                        : ""}
                    </p>
                  </div>
                  {!row.locked ? (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => {
                          const quota =
                            row.packageQuotaCode || row.procedureCode;
                          const rem = draftRemaining.get(quota) ?? 0;
                          if (rem < 1) return;
                          const burn =
                            quota !== row.procedureCode ? quota : null;
                          pushDraft({
                            procedureCode: row.procedureCode,
                            procedureName: row.procedureName,
                            qty: 1,
                            note: "",
                            paramsLabel: row.paramsLabel ?? "",
                            fingerprint: `committed:${row.assignBatchId ?? row.procedureCode}`,
                            burnPoolCode: burn,
                          });
                        }}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || row.qty < 1}
                        onClick={() => void decreaseAssigned(row)}
                        title={labels.qtyDown ?? "−1"}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => openReplace(row)}
                      >
                        {labels.replace ?? "Replace"}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void removeAssigned(row)}
                      >
                        {labels.delete}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {draft.map((d) => (
                <li
                  key={d.key}
                  className={`${CARD_CONTAINER_CLASS} flex items-center justify-between gap-2 border-dashed px-3 py-2 text-[13px]`}
                >
                  <div>
                    <div className="font-medium">{d.procedureName}</div>
                    {d.paramsLabel ? (
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{d.paramsLabel}</p>
                    ) : null}
                    <p className={TEXT_MUTED_CLASS}>×{d.qty} (draft)</p>
                  </div>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setDraft((prev) => prev.filter((x) => x.key !== d.key))}
                  >
                    {labels.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {formBurnPool || formCode ? (
            <div className="absolute inset-y-0 right-0 z-10 max-h-full w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg md:w-[calc(50%-0.5rem)]">
              <h4 className="mb-2 font-medium">
                {formBurnPool && !formCode
                  ? balances.find((b) => b.procedureCode === formBurnPool)?.procedureName ??
                    formBurnPool
                  : formName}
              </h4>
              {formBurnPool ? (
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
                  <label className="mb-2 block text-[12px]">
                    {labels.qty}
                    <input
                      type="number"
                      min={1}
                      max={draftRemaining.get(formQuotaCode ?? formCode) ?? 1}
                      className={`${MODAL_INPUT_CLASS} mt-1 w-[6ch]`}
                      value={formQty}
                      onChange={(e) => setFormQty(Number(e.target.value) || 1)}
                    />
                  </label>
                  <div className="mb-3">
                    <PhysioSiteChips
                      value={formPhysio}
                      catalog={catalog}
                      programs={programs}
                      substances={substances}
                      locale={locale}
                      editable
                      compact
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
            <div className="absolute inset-y-0 right-0 z-20 max-h-full w-full overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/90 p-3 shadow-lg md:w-[calc(50%-0.5rem)]">
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
                  type="number"
                  min={1}
                  className={`${MODAL_INPUT_CLASS} mt-1 w-[6ch]`}
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
