"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  CARD_CONTAINER_CLASS,
  DatePicker,
  Field,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { EPISODE_MODAL_CLASS } from "@/components/sanatorium/episode-modal-class";
import { pickL10n, type L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { todayBakuYmd } from "@/lib/baku-day";
import {
  buildVisitScheduledAt,
  parseDraftSchedule,
} from "@/domain/sanatorium/diagnostics-schedule";

type BalanceRow = {
  procedureCode: string;
  procedureName: string;
  remaining: number;
  fulfillment?: "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";
  assignable?: boolean;
};

type AssignedStudy = {
  id: string;
  kind: "lab" | "visit";
  serviceCode: string;
  title: string;
  qty: number;
  packageQuotaCode: string;
  locked: boolean;
  status: string;
};

type PendingRow = {
  id: string;
  kind: "lab" | "visit";
  serviceCode: string;
  title: string;
  amountNet: number;
};

type CatalogItem = {
  code: string;
  kind: string;
  title: L10n;
};

type CatalogGroup = {
  key: string;
  title: L10n;
  itemCodes: string[];
  kind: string;
};

type PkgDraft = {
  key: string;
  serviceCode: string;
  title: string;
  qty: number;
  kind: string;
};

type ExtraDraft = {
  key: string;
  serviceCode: string;
  title: string;
  qty: number;
  kind: string;
  amountNet: number;
  scheduledAt?: string;
};

type Props = {
  open: boolean;
  episodeId: string;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
};

export function DiagnosticsAssignModal({
  open,
  episodeId,
  onClose,
  onSaved,
  readOnly,
}: Props) {
  const t = useTranslations("patientCard");
  const tPhysio = useTranslations("physio");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [assignedStudies, setAssignedStudies] = useState<AssignedStudy[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogGroups, setCatalogGroups] = useState<CatalogGroup[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [pkgDraft, setPkgDraft] = useState<PkgDraft[]>([]);
  const [extraDraft, setExtraDraft] = useState<ExtraDraft[]>([]);
  const [visitDate, setVisitDate] = useState(todayBakuYmd());
  const [visitTime, setVisitTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const studyBalances = useMemo(
    () =>
      balances.filter(
        (b) =>
          (b.fulfillment === "LAB_ORDER" || b.fulfillment === "VISIT") &&
          b.remaining > 0,
      ),
    [balances],
  );

  const clinicalLock =
    blockReason === "NO_ANAMNESIS" ||
    blockReason === "NO_COMPLAINT" ||
    blockReason === "NO_DIAGNOSIS" ||
    blockReason === "NO_CARE_TEAM";

  const unitOf = useCallback(
    (code: string) => {
      const n = Number(prices[code] ?? 0);
      return n > 0 ? n : 0;
    },
    [prices],
  );

  const load = useCallback(async () => {
    if (!episodeId) return;
    setLoading(true);
    try {
      const [snapRes, pendingRes, catRes] = await Promise.all([
        fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`),
        fetch(`/api/sanatorium/episodes/${episodeId}/diagnostics-extras`),
        fetch(
          "/api/diagnostic-catalog?kinds=lab_panel,imaging,functional,endoscopy,visit&applyFavorites=false",
        ),
      ]);
      const snapBody = await snapRes.json().catch(() => ({}));
      const pendingBody = await pendingRes.json().catch(() => ({}));
      const catBody = await catRes.json().catch(() => ({}));
      if (snapRes.ok) {
        const data = snapBody.data ?? snapBody;
        const rows = Array.isArray(data.studyBalances)
          ? data.studyBalances
          : Array.isArray(data.balances)
            ? data.balances
            : [];
        setBalances(rows);
        setAssignedStudies(
          Array.isArray(data.assignedStudies) ? data.assignedStudies : [],
        );
        setBlockReason(
          typeof data.blockReason === "string" ? data.blockReason : null,
        );
      }
      if (pendingRes.ok) {
        const data = pendingBody.data ?? pendingBody;
        const items = Array.isArray(data.items) ? data.items : [];
        setPending(
          items.map(
            (row: {
              id: string;
              kind: "lab" | "visit";
              serviceCode: string;
              title: string;
              amountNet: number;
            }) => ({
              id: row.id,
              kind: row.kind,
              serviceCode: row.serviceCode,
              title: row.title,
              amountNet: Number(row.amountNet),
            }),
          ),
        );
        setPrices(
          data.prices && typeof data.prices === "object"
            ? (data.prices as Record<string, number>)
            : {},
        );
      }
      if (catRes.ok) {
        const data = catBody.data ?? catBody;
        const items = Array.isArray(data.items) ? data.items : [];
        const groups = Array.isArray(data.groups) ? data.groups : [];
        setCatalogItems(
          items
            .filter((s: { kind?: string }) =>
              ["lab_panel", "imaging", "functional", "endoscopy", "visit"].includes(
                String(s.kind ?? ""),
              ),
            )
            .map(
              (s: {
                code: string;
                kind: string;
                title?: L10n;
                titleAz?: string;
                titleRu?: string;
                titleEn?: string;
              }) => ({
                code: s.code,
                kind: s.kind,
                title:
                  s.title && typeof s.title === "object"
                    ? s.title
                    : {
                        az: s.titleAz ?? s.code,
                        ru: s.titleRu ?? s.code,
                        en: s.titleEn ?? s.code,
                      },
              }),
            ),
        );
        setCatalogGroups(
          groups.map(
            (g: {
              key: string;
              kind: string;
              title: L10n;
              itemCodes: string[];
            }) => ({
              key: g.key,
              kind: g.kind,
              title: g.title,
              itemCodes: Array.isArray(g.itemCodes) ? g.itemCodes : [],
            }),
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (!open) return;
    setPkgDraft([]);
    setExtraDraft([]);
    setOpenGroups(new Set());
    void load();
  }, [open, load]);

  const draftRemaining = useMemo(() => {
    const map = new Map(studyBalances.map((b) => [b.procedureCode, b.remaining]));
    for (const d of pkgDraft) {
      map.set(d.serviceCode, Math.max(0, (map.get(d.serviceCode) ?? 0) - d.qty));
    }
    return map;
  }, [studyBalances, pkgDraft]);

  function addPackageBurn(row: BalanceRow) {
    if (readOnly || clinicalLock || busy) return;
    const rem = draftRemaining.get(row.procedureCode) ?? 0;
    if (rem < 1) return;
    const kind = row.fulfillment === "VISIT" ? "visit" : "lab_panel";
    setPkgDraft((prev) => {
      const hit = prev.find((d) => d.serviceCode === row.procedureCode);
      if (hit) {
        return prev.map((d) =>
          d.key === hit.key ? { ...d, qty: d.qty + 1 } : d,
        );
      }
      return [
        ...prev,
        {
          key: `pkg:${row.procedureCode}:${Date.now()}`,
          serviceCode: row.procedureCode,
          title: row.procedureName,
          qty: 1,
          kind,
        },
      ];
    });
  }

  function addCatalogExtra(code: string, title: string, kind: string) {
    if (readOnly || busy) return;
    const rem = draftRemaining.get(code) ?? 0;
    if (rem > 0) {
      const bal = studyBalances.find((b) => b.procedureCode === code);
      if (bal) {
        addPackageBurn(bal);
        return;
      }
    }
    const amountNet = unitOf(code);
    const scheduledAt =
      kind === "visit" ? buildVisitScheduledAt(visitDate, visitTime) : undefined;
    setExtraDraft((prev) => {
      const hit = prev.find((d) => d.serviceCode === code);
      if (hit) {
        return prev.map((d) =>
          d.key === hit.key ? { ...d, qty: d.qty + 1 } : d,
        );
      }
      return [
        ...prev,
        {
          key: `x:${code}:${Date.now()}`,
          serviceCode: code,
          title,
          qty: 1,
          kind,
          amountNet,
          scheduledAt,
        },
      ];
    });
  }

  const amountDue = useMemo(() => {
    const draftSum = extraDraft.reduce(
      (sum, row) => sum + row.amountNet * row.qty,
      0,
    );
    const pendingSum = pending.reduce(
      (sum, row) => sum + Number(row.amountNet || 0),
      0,
    );
    return draftSum + pendingSum;
  }, [extraDraft, pending]);

  const canSave =
    !readOnly &&
    !busy &&
    (pkgDraft.length > 0 || extraDraft.length > 0) &&
    !(pkgDraft.length > 0 && clinicalLock);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      if (pkgDraft.length > 0) {
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/package-assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines: pkgDraft.map((d) => ({
                procedureCode: d.serviceCode,
                qty: d.qty,
              })),
            }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(body, tc("saveFailed"));
          return;
        }
        // Avoid double-burn if extras fail next — package lines already persisted.
        setPkgDraft([]);
      }
      if (extraDraft.length > 0) {
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/diagnostics-extras`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines: extraDraft.map((d) => ({
                serviceCode: d.serviceCode,
                qty: d.qty,
                scheduledAt:
                  d.kind === "visit" ? d.scheduledAt ?? null : null,
              })),
            }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const code = typeof body?.code === "string" ? body.code : null;
          showApiError(
            {
              error:
                code === "NO_PRICE"
                  ? tPhysio("labExtraNoPrice")
                  : code === "LAB_ALREADY_OPEN"
                    ? t("labAlreadyOpen", {
                        defaultValue:
                          "An open lab order already exists for this study",
                      })
                    : code === "NO_CARE_TEAM"
                      ? t("careTeamRequired", {
                          defaultValue: "A care-team doctor is required",
                        })
                      : code === "QUOTA_REMAINING"
                        ? t("usePackageFirst", {
                            defaultValue:
                              "Use package remaining before a paid diagnostic",
                          })
                        : typeof body?.error === "string"
                          ? body.error
                          : tc("saveFailed"),
            },
          );
          return;
        }
      }
      showSuccess(tc("saved"));
      setPkgDraft([]);
      setExtraDraft([]);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function removePending(row: PendingRow) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/diagnostics-extras?id=${encodeURIComponent(row.id)}&kind=${row.kind}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("failed"));
        return;
      }
      await load();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const itemByCode = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalogItems) map.set(item.code, item);
    return map;
  }, [catalogItems]);

  const extraGroupRows = useMemo(() => {
    const out: Array<{
      key: string;
      title: string;
      items: Array<{ code: string; label: string; kind: string }>;
    }> = [];
    for (const g of catalogGroups) {
      const items = g.itemCodes
        .map((code) => itemByCode.get(code))
        .filter((row): row is CatalogItem => Boolean(row))
        .map((row) => ({
          code: row.code,
          kind: row.kind,
          label: pickL10n(row.title, locale) || row.code,
        }));
      if (items.length === 0) continue;
      out.push({
        key: g.key,
        title: pickL10n(g.title, locale) || g.key,
        items,
      });
    }
    if (out.length === 0 && catalogItems.length > 0) {
      out.push({
        key: "all",
        title: t("diagnosticsExtraTitle", { defaultValue: "Additional (catalog)" }),
        items: catalogItems.map((row) => ({
          code: row.code,
          kind: row.kind,
          label: pickL10n(row.title, locale) || row.code,
        })),
      });
    }
    return out;
  }, [catalogGroups, catalogItems, itemByCode, locale, t]);

  type Lane = {
    key: string;
    code: string;
    title: string;
    kind: string;
    pkgQty: number;
    pkgLocked: boolean;
    pkgDraftKey?: string;
    extraDraftKey?: string;
    extraQty: number;
    extraUnit: number;
    pendingIds: string[];
  };

  const lanes = useMemo(() => {
    const map = new Map<string, Lane>();
    const ensure = (code: string, title: string, kind: string): Lane => {
      let lane = map.get(code);
      if (!lane) {
        lane = {
          key: code,
          code,
          title,
          kind,
          pkgQty: 0,
          pkgLocked: false,
          extraQty: 0,
          extraUnit: unitOf(code),
          pendingIds: [],
        };
        map.set(code, lane);
      }
      return lane;
    };
    for (const row of assignedStudies) {
      const lane = ensure(row.serviceCode, row.title, row.kind);
      lane.pkgQty += row.qty;
      if (row.locked) lane.pkgLocked = true;
    }
    for (const d of pkgDraft) {
      const lane = ensure(d.serviceCode, d.title, d.kind);
      lane.pkgQty += d.qty;
      lane.pkgDraftKey = d.key;
    }
    for (const d of extraDraft) {
      const lane = ensure(d.serviceCode, d.title, d.kind);
      lane.extraQty += d.qty;
      lane.extraUnit = d.amountNet > 0 ? d.amountNet : unitOf(d.serviceCode);
      lane.extraDraftKey = d.key;
    }
    for (const row of pending) {
      const lane = ensure(row.serviceCode, row.title, row.kind);
      lane.extraQty += 1;
      if (!(lane.extraUnit > 0)) lane.extraUnit = Number(row.amountNet || 0);
      lane.pendingIds.push(row.id);
    }
    return [...map.values()].filter(
      (lane) => lane.pkgQty > 0 || lane.extraQty > 0,
    );
  }, [assignedStudies, pkgDraft, extraDraft, pending, unitOf]);

  const stepper = (
    qty: number,
    onMinus: () => void,
    onPlus: () => void,
    plusDisabled: boolean,
    minusDisabled: boolean,
  ) => (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
        disabled={busy || minusDisabled || qty < 1}
        onClick={onMinus}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="w-6 text-center tabular-nums">{qty}</span>
      <button
        type="button"
        className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
        disabled={busy || plusDisabled}
        onClick={onPlus}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );

  return (
    <ModalShell
      open={open}
      title={t("diagnosticsAssignTitle", {
        defaultValue: "Analyses and diagnostics",
      })}
      onClose={onClose}
      closeLabel={tc("close")}
      maxWidthClass={EPISODE_MODAL_CLASS}
      bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className={`text-[13px] font-medium tabular-nums`}>
            {tPhysio("amountDue")}: {amountDue.toFixed(2)} AZN
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={onClose}
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!canSave}
              onClick={() => void save()}
            >
              {tc("save")}
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
      ) : (
        <div className="grid h-full min-h-0 flex-1 grid-rows-1 gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <h4 className="text-sm font-medium">
              {t("diagnosticsInPackage", { defaultValue: "In package" })}
            </h4>
            {studyBalances.length === 0 ? (
              <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
                {t("diagnosticsPackageEmpty", {
                  defaultValue:
                    "No package lab or exam remaining on this course.",
                })}
              </p>
            ) : (
              <ul className="space-y-1">
                {studyBalances.map((row) => {
                  const rem =
                    draftRemaining.get(row.procedureCode) ?? row.remaining;
                  return (
                    <li
                      key={row.procedureCode}
                      className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium leading-tight">
                          {row.procedureName}
                        </div>
                        <p
                          className={`text-[11px] leading-tight ${TEXT_MUTED_CLASS}`}
                        >
                          {tPhysio("remaining")}: {rem} / {row.remaining}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`${PRIMARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                        disabled={
                          readOnly || busy || clinicalLock || rem < 1
                        }
                        onClick={() => addPackageBurn(row)}
                      >
                        +
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pt-3">
              <h4 className="mb-2 text-sm font-medium">
                {t("diagnosticsExtraTitle", {
                  defaultValue: "Additional (catalog)",
                })}
              </h4>
              {extraGroupRows.map((group) => {
                const open = openGroups.has(group.key);
                return (
                  <div key={group.key} className="mb-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 py-1 text-left text-[12px] font-semibold text-[#1F4E79]"
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.key)) next.delete(group.key);
                          else next.add(group.key);
                          return next;
                        })
                      }
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {open ? (
                      <ul className="space-y-1">
                        {group.items.map((item) => (
                          <li
                            key={item.code}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {item.label}
                            </span>
                            <button
                              type="button"
                              className={`${PRIMARY_BUTTON_CLASS} !px-2 !py-0.5 text-[12px]`}
                              disabled={readOnly || busy}
                              onClick={() =>
                                addCatalogExtra(
                                  item.code,
                                  item.label,
                                  item.kind,
                                )
                              }
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

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <h4 className="text-sm font-medium">
              {tPhysio("assignedReceiptTitle")}
            </h4>
            {lanes.length === 0 ? (
              <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
                {t("diagnosticsDraftEmpty", {
                  defaultValue:
                    "Add studies from the package menu or catalog.",
                })}
              </p>
            ) : (
              <ul className="space-y-2">
                {lanes.map((lane) => {
                  const rem = draftRemaining.get(lane.code) ?? 0;
                  const sched =
                    lane.kind === "visit" && lane.extraDraftKey
                      ? parseDraftSchedule(
                          extraDraft.find((d) => d.key === lane.extraDraftKey)
                            ?.scheduledAt,
                        )
                      : { date: "", time: "" };
                  return (
                    <li
                      key={lane.key}
                      className={`${CARD_CONTAINER_CLASS} space-y-1 px-3 py-2 text-[13px] ${
                        lane.pkgLocked ? "opacity-90" : ""
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0 font-medium">{lane.title}</div>
                        {!lane.pkgLocked &&
                        lane.pkgDraftKey &&
                        lane.extraQty < 1 &&
                        lane.pendingIds.length < 1 ? (
                          <button
                            type="button"
                            className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                            disabled={busy}
                            onClick={() =>
                              setPkgDraft((prev) =>
                                prev.filter((d) => d.key !== lane.pkgDraftKey),
                              )
                            }
                            aria-label={tc("delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      {lane.pkgQty > 0 ? (
                        <div className="flex items-center justify-between gap-2 py-1">
                          <span className={TEXT_MUTED_CLASS}>
                            {tPhysio("fromPackage")}
                          </span>
                          {lane.pkgLocked && !lane.pkgDraftKey ? (
                            <span className="tabular-nums">{lane.pkgQty}</span>
                          ) : (
                            stepper(
                              lane.pkgQty,
                              () => {
                                if (!lane.pkgDraftKey) return;
                                setPkgDraft((prev) =>
                                  prev
                                    .map((d) =>
                                      d.key === lane.pkgDraftKey
                                        ? { ...d, qty: d.qty - 1 }
                                        : d,
                                    )
                                    .filter((d) => d.qty > 0),
                                );
                              },
                              () => {
                                const bal = studyBalances.find(
                                  (b) => b.procedureCode === lane.code,
                                );
                                if (bal) addPackageBurn(bal);
                              },
                              rem < 1 || clinicalLock,
                              Boolean(lane.pkgLocked) || !lane.pkgDraftKey,
                            )
                          )}
                          <span className="tabular-nums text-[12px]">
                            0.00
                          </span>
                        </div>
                      ) : null}
                      {lane.extraQty > 0 ? (
                        <div className="flex items-center justify-between gap-2 py-1">
                          <span className={TEXT_MUTED_CLASS}>
                            {tPhysio("extraLine")}
                          </span>
                          {lane.extraDraftKey ? (
                            stepper(
                              lane.extraQty - lane.pendingIds.length,
                              () => {
                                setExtraDraft((prev) =>
                                  prev
                                    .map((d) =>
                                      d.key === lane.extraDraftKey
                                        ? { ...d, qty: d.qty - 1 }
                                        : d,
                                    )
                                    .filter((d) => d.qty > 0),
                                );
                              },
                              () => {
                                const draft = extraDraft.find(
                                  (d) => d.key === lane.extraDraftKey,
                                );
                                if (draft) {
                                  addCatalogExtra(
                                    draft.serviceCode,
                                    draft.title,
                                    draft.kind,
                                  );
                                }
                              },
                              false,
                              false,
                            )
                          ) : (
                            <span className="tabular-nums">{lane.extraQty}</span>
                          )}
                          <span className="tabular-nums text-[12px]">
                            {(lane.extraUnit * lane.extraQty).toFixed(2)}
                          </span>
                          {lane.pendingIds.length > 0 ? (
                            <button
                              type="button"
                              className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                              disabled={busy}
                              onClick={() => {
                                const id = lane.pendingIds[0];
                                const row = pending.find((p) => p.id === id);
                                if (row) void removePending(row);
                              }}
                              aria-label={tc("delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : lane.extraDraftKey ? (
                            <button
                              type="button"
                              className={`${TABLE_ROW_ICON_BTN_CLASS} !h-6 !w-6`}
                              disabled={busy}
                              onClick={() =>
                                setExtraDraft((prev) =>
                                  prev.filter(
                                    (d) => d.key !== lane.extraDraftKey,
                                  ),
                                )
                              }
                              aria-label={tc("delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {lane.kind === "visit" && lane.extraDraftKey ? (
                        <div className="flex flex-wrap items-end gap-2 pt-1">
                          <DatePicker
                            label={t("visitDate", { defaultValue: "Date" })}
                            value={sched.date || todayBakuYmd()}
                            onChange={(v) => {
                              const date = v || todayBakuYmd();
                              setExtraDraft((prev) =>
                                prev.map((d) =>
                                  d.key === lane.extraDraftKey
                                    ? {
                                        ...d,
                                        scheduledAt: buildVisitScheduledAt(
                                          date,
                                          sched.time,
                                        ),
                                      }
                                    : d,
                                ),
                              );
                            }}
                            placeholder="dd.mm.yyyy"
                          />
                          <Field
                            type="time"
                            preset="time"
                            label={t("visitTime", { defaultValue: "Time" })}
                            hint={t("visitTimeOptional", {
                              defaultValue: "Optional",
                            })}
                            value={sched.time}
                            onChange={(e) => {
                              const time = e.target.value;
                              setExtraDraft((prev) =>
                                prev.map((d) =>
                                  d.key === lane.extraDraftKey
                                    ? {
                                        ...d,
                                        scheduledAt: buildVisitScheduledAt(
                                          sched.date || todayBakuYmd(),
                                          time,
                                        ),
                                      }
                                    : d,
                                ),
                              );
                            }}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
