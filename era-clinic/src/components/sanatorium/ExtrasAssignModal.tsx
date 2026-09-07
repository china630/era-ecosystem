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

type ProcOption = { value: string; label: string; name: string; amount?: number };

type DraftLine = {
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

type PendingRow = {
  id: string;
  procedureCode: string;
  procedureName: string;
  amountNet: number;
  status: string;
  note?: string | null;
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
    pickProcedure: string;
    qty: string;
    note: string;
    addToDraft: string;
    pending: string;
    price: string;
    delete: string;
    empty: string;
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

function gateToPhysio(code: string, name: string): PhysioChipsValue {
  const gate = inferPhysioTypeGate(code, name);
  return {
    ...EMPTY_PHYSIO,
    needsSite: gate.needsSite,
    physioOrderFields: gate.fields,
    allowedSiteCodes: gate.allowedSiteCodes,
    forceSiteTogether: gate.forceSiteTogether,
    sitesHintKey: gate.sitesHintKey,
    siteApplyMode: gate.forceSiteTogether ? "TOGETHER" : null,
  };
}

function paramsLabelFromPhysio(
  p: PhysioChipsValue,
  catalog: PhysioCatalogSite[],
): string {
  const parts: string[] = [];
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const siteNames = (p.siteIds ?? [])
    .map((id) => byId.get(id)?.titleEn || byId.get(id)?.code)
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

/** CLI-57 extras modal — prescribe to PENDING_PAY with price + physio form overlay. */
export function ExtrasAssignModal({
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
  const [options, setOptions] = useState<ProcOption[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [code, setCode] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [formPhysio, setFormPhysio] = useState<PhysioChipsValue>(EMPTY_PHYSIO);
  const [catalog, setCatalog] = useState<PhysioCatalogSite[]>([]);
  const [programs, setPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [substances, setSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [typesRes, pendRes, catRes] = await Promise.all([
      fetch("/api/procedure-types"),
      fetch(`/api/sanatorium/episodes/${episodeId}/extras-prescribe`),
      fetch("/api/physio-catalog"),
    ]);
    let priceMap: Record<string, number> = {};
    if (pendRes.ok) {
      const d = await pendRes.json();
      const payload = d.data ?? d;
      setPending(payload.items ?? []);
      priceMap = payload.prices ?? {};
      setPrices(priceMap);
    }
    if (typesRes.ok) {
      const d = await typesRes.json();
      const rows = (d.data ?? d.items ?? d) as Array<{
        code: string;
        name: string;
      }>;
      if (Array.isArray(rows)) {
        setOptions(
          rows.map((r) => ({
            value: r.code,
            label: r.name || r.code,
            name: r.name,
            amount: priceMap[r.code] ?? 25,
          })),
        );
      }
    }
    if (catRes.ok) {
      const data = await catRes.json();
      setCatalog((data.sites ?? data.data?.sites ?? []) as PhysioCatalogSite[]);
      setPrograms((data.programs ?? data.data?.programs ?? []) as PhysioCatalogListItem[]);
      setSubstances(
        (data.substances ?? data.data?.substances ?? []) as PhysioCatalogListItem[],
      );
    }
  }, [episodeId]);

  const draftTotal = useMemo(
    () => draft.reduce((s, d) => s + d.amountNet * d.qty, 0),
    [draft],
  );
  const pendingTotal = useMemo(
    () => pending.reduce((s, p) => s + Number(p.amountNet || 0), 0),
    [pending],
  );

  useEffect(() => {
    if (!open) return;
    setDraft([]);
    setCode("");
    setFormOpen(false);
    setError(null);
    void load();
  }, [open, load]);

  const selected = useMemo(
    () => options.find((o) => o.value === code),
    [options, code],
  );

  function openFormForCode(nextCode: string) {
    setCode(nextCode);
    const opt = options.find((o) => o.value === nextCode);
    setFormPhysio(gateToPhysio(nextCode, opt?.name ?? nextCode));
    setQty(1);
    setFormOpen(true);
  }

  function addDraft() {
    if (!code || !selected) return;
    const unit = prices[code] ?? selected.amount ?? 25;
    setDraft((prev) => [
      ...prev,
      {
        key: `${code}-${Date.now()}`,
        procedureCode: code,
        procedureName: selected.name,
        qty: Math.max(1, qty),
        amountNet: unit,
        note: formPhysio.note ?? "",
        physioFields: formPhysio.physioFields as Record<string, unknown>,
        siteIds: formPhysio.siteIds,
        siteApplyMode: formPhysio.siteApplyMode,
        siteLaterality: formPhysio.siteLaterality,
        paramsLabel: paramsLabelFromPhysio(formPhysio, catalog),
      },
    ]);
    setCode("");
    setQty(1);
    setFormOpen(false);
    setFormPhysio(EMPTY_PHYSIO);
  }

  async function save() {
    if (draft.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/extras-prescribe`,
        {
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
            })),
          }),
        },
      );
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Save failed");
        return;
      }
      setDraft([]);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function removePending(orderId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/extras-prescribe?orderId=${encodeURIComponent(orderId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Delete failed");
        return;
      }
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
        <div className="flex justify-end gap-2">
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
      <div className="relative mb-4 space-y-2">
        <div className="max-w-md">
          <CatalogField
            kind="SEARCHABLE"
            label={labels.pickProcedure}
            value={code}
            onChange={(v) => {
              const next = String(v ?? "");
              if (next) openFormForCode(next);
              else {
                setCode("");
                setFormOpen(false);
              }
            }}
            options={options}
            widthPreset="select"
          />
        </div>
        {selected && !formOpen ? (
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
            {labels.price}: {(prices[code] ?? selected.amount ?? 25).toFixed(2)} AZN
          </p>
        ) : null}

        {formOpen && selected ? (
          <div className="z-10 max-w-xl rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <h4 className="mb-1 font-medium">{selected.name}</h4>
            <p className={`mb-2 text-[12px] ${TEXT_MUTED_CLASS}`}>
              {labels.price}: {(prices[code] ?? selected.amount ?? 25).toFixed(2)} AZN
            </p>
            <label className="mb-2 block text-[12px]">
              {labels.qty}
              <input
                type="number"
                min={1}
                className={`${MODAL_INPUT_CLASS} mt-1 w-[6ch]`}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
              />
            </label>
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
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setFormOpen(false);
                  setCode("");
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={addDraft}
              >
                {labels.addToDraft}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <h4 className="mb-2 text-sm font-medium">{labels.pending}</h4>
      {pending.length === 0 && draft.length === 0 ? (
        <p className={TEXT_MUTED_CLASS}>{labels.empty}</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li
              key={p.id}
              className={`${CARD_CONTAINER_CLASS} flex items-center justify-between gap-2 px-3 py-2 text-[13px]`}
            >
              <div>
                <div className="font-medium">{p.procedureName}</div>
                <p className={TEXT_MUTED_CLASS}>
                  {labels.price}: {p.amountNet.toFixed(2)} AZN · {p.status}
                </p>
              </div>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void removePending(p.id)}
              >
                {labels.delete}
              </button>
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
                <p className={TEXT_MUTED_CLASS}>
                  ×{d.qty} · {(d.amountNet * d.qty).toFixed(2)} AZN
                </p>
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
      {(pending.length > 0 || draft.length > 0) && (
        <p className="mt-3 text-right text-[15px] font-bold text-[#2C3E50]">
          Total: {(pendingTotal + draftTotal).toFixed(2)} AZN
        </p>
      )}
    </ModalShell>
  );
}
