"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  Field,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { Minus, Plus, Trash2 } from "lucide-react";
import { EPISODE_MODAL_CLASS } from "@/components/sanatorium/episode-modal-class";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { todayBakuYmd } from "@/lib/baku-day";
import {
  buildVisitScheduledAt,
  formatDraftSchedule,
  parseDraftSchedule,
} from "@/domain/sanatorium/diagnostics-schedule";

type BalanceRow = {
  procedureCode: string;
  procedureName: string;
  remaining: number;
  fulfillment?: "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";
  assignable?: boolean;
};

type PendingRow = {
  id: string;
  kind: "lab" | "visit";
  serviceCode: string;
  title: string;
  amountNet: number;
};

type CatalogOption = {
  value: string;
  /** Picker label including kind suffix. */
  label: string;
  /** Plain study title for draft rows. */
  title: string;
  kind: string;
};

type DraftLine = {
  key: string;
  serviceCode: string;
  title: string;
  qty: number;
  kind: string;
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
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [pickerCode, setPickerCode] = useState("");
  const [visitDate, setVisitDate] = useState(todayBakuYmd());
  const [visitTime, setVisitTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const studyBalances = useMemo(
    () =>
      balances.filter(
        (b) =>
          (b.fulfillment === "LAB_ORDER" || b.fulfillment === "VISIT") &&
          b.assignable !== false &&
          b.remaining > 0,
      ),
    [balances],
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
      }
      if (catRes.ok) {
        const data = catBody.data ?? catBody;
        const items = Array.isArray(data.items) ? data.items : [];
        setCatalog(
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
                title?: { az?: string; ru?: string; en?: string } | string;
                titleAz?: string;
                titleRu?: string;
                titleEn?: string;
              }) => {
                const title =
                  typeof s.title === "string"
                    ? s.title
                    : pickL10n(
                        {
                          az: s.titleAz ?? s.title?.az ?? "",
                          ru: s.titleRu ?? s.title?.ru ?? "",
                          en: s.titleEn ?? s.title?.en ?? "",
                        },
                        locale,
                      ) || s.code;
                const kindTag =
                  s.kind === "visit"
                    ? t("fulfillmentVisit", { defaultValue: "Visit" })
                    : t("fulfillmentLab", { defaultValue: "Lab" });
                return {
                  value: s.code,
                  title,
                  label: `${title} · ${kindTag}`,
                  kind: s.kind,
                };
              },
            ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [episodeId, locale, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function addFromBalance(row: BalanceRow) {
    setDraft((prev) => {
      const existing = prev.find((d) => d.serviceCode === row.procedureCode);
      if (existing) {
        return prev.map((d) =>
          d.key === existing.key ? { ...d, qty: d.qty + 1 } : d,
        );
      }
      return [
        ...prev,
        {
          key: `${row.procedureCode}-${Date.now()}`,
          serviceCode: row.procedureCode,
          title: row.procedureName,
          qty: 1,
          kind: row.fulfillment === "VISIT" ? "visit" : "lab_panel",
        },
      ];
    });
  }

  function addFromCatalog() {
    const opt = catalog.find((c) => c.value === pickerCode);
    if (!opt) return;
    setDraft((prev) => {
      const existing = prev.find((d) => d.serviceCode === opt.value);
      if (existing) {
        return prev.map((d) =>
          d.key === existing.key ? { ...d, qty: d.qty + 1 } : d,
        );
      }
      const scheduledAt =
        opt.kind === "visit" ? buildVisitScheduledAt(visitDate, visitTime) : undefined;
      return [
        ...prev,
        {
          key: `${opt.value}-${Date.now()}`,
          serviceCode: opt.value,
          title: opt.title,
          qty: 1,
          kind: opt.kind,
          scheduledAt,
        },
      ];
    });
    setPickerCode("");
  }

  function patchDraftSchedule(key: string, dateYmd: string, timeHm: string) {
    setDraft((prev) =>
      prev.map((d) => {
        if (d.key !== key || d.kind !== "visit") return d;
        return {
          ...d,
          scheduledAt: buildVisitScheduledAt(dateYmd, timeHm),
        };
      }),
    );
  }

  async function save() {
    if (readOnly || draft.length < 1) return;
    setBusy(true);
    try {
      // In-quota package studies: burn remaining first, overflow becomes paid.
      const assignLines: Array<{ procedureCode: string; qty: number }> = [];
      const extraLines: Array<{
        serviceCode: string;
        qty: number;
        scheduledAt?: string | null;
      }> = [];

      for (const d of draft) {
        const bal = studyBalances.find((b) => b.procedureCode === d.serviceCode);
        const inQuota = bal ? Math.min(d.qty, bal.remaining) : 0;
        const paid = d.qty - inQuota;
        if (inQuota > 0) {
          assignLines.push({ procedureCode: d.serviceCode, qty: inQuota });
        }
        if (paid > 0) {
          extraLines.push({
            serviceCode: d.serviceCode,
            qty: paid,
            scheduledAt: d.kind === "visit" ? d.scheduledAt ?? null : null,
          });
        }
      }

      if (assignLines.length > 0) {
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: assignLines }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(body, tc("saveFailed"));
          return;
        }
      }
      if (extraLines.length > 0) {
        const res = await fetch(
          `/api/sanatorium/episodes/${episodeId}/diagnostics-extras`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines: extraLines }),
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
                        defaultValue: "An open lab order already exists for this study",
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
      setDraft([]);
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

  const draftSplit = useMemo(() => {
    let packageQty = 0;
    let paidQty = 0;
    for (const d of draft) {
      const bal = studyBalances.find((b) => b.procedureCode === d.serviceCode);
      const inQuota = bal ? Math.min(d.qty, bal.remaining) : 0;
      packageQty += inQuota;
      paidQty += Math.max(0, d.qty - inQuota);
    }
    return { packageQty, paidQty };
  }, [draft, studyBalances]);

  const pendingTotal = useMemo(
    () => pending.reduce((sum, row) => sum + Number(row.amountNet || 0), 0),
    [pending],
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
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
            {t("diagnosticsDraftSummary", {
              defaultValue: "Package {packageQty} · paid overflow {paidQty} · awaiting {pendingAmount} AZN",
              packageQty: draftSplit.packageQty,
              paidQty: draftSplit.paidQty,
              pendingAmount: pendingTotal.toFixed(2),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
              {tc("close")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={readOnly || busy || draft.length < 1}
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
                  defaultValue: "No package lab or exam remaining on this course.",
                })}
              </p>
            ) : (
              <ul className="space-y-1">
                {studyBalances.map((row) => (
                  <li
                    key={row.procedureCode}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 py-1.5 text-[13px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium leading-tight">
                        {row.procedureName}
                      </div>
                      <p className={`text-[11px] leading-tight ${TEXT_MUTED_CLASS}`}>
                        {row.remaining} ·{" "}
                        {row.fulfillment === "VISIT"
                          ? t("fulfillmentVisit", { defaultValue: "Visit" })
                          : t("fulfillmentLab", { defaultValue: "Lab" })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={readOnly || busy}
                      onClick={() => addFromBalance(row)}
                      aria-label={row.procedureName}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="pt-2 text-sm font-medium">
              {t("diagnosticsExtraTitle", {
                defaultValue: "Additional (awaiting payment)",
              })}
            </h4>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <CatalogField
                  kind="SEARCHABLE"
                  label={t("diagnosticsPick", { defaultValue: "Study" })}
                  value={pickerCode}
                  onChange={(v) => setPickerCode(String(v ?? ""))}
                  options={catalog.map((c) => ({ value: c.value, label: c.label }))}
                />
              </div>
              {catalog.find((c) => c.value === pickerCode)?.kind === "visit" ? (
                <>
                  <DatePicker
                    label={t("visitDate", { defaultValue: "Date" })}
                    value={visitDate}
                    onChange={(v) => setVisitDate(v || todayBakuYmd())}
                    placeholder="dd.mm.yyyy"
                  />
                  <Field
                    type="time"
                    preset="time"
                    label={t("visitTime", { defaultValue: "Time" })}
                    hint={t("visitTimeOptional", { defaultValue: "Optional" })}
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                  />
                </>
              ) : null}
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={readOnly || busy || !pickerCode}
                onClick={addFromCatalog}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <h4 className="text-sm font-medium">
              {t("diagnosticsDraft", { defaultValue: "Selected" })}
            </h4>
            {draft.length === 0 && pending.length === 0 ? (
              <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
                {t("diagnosticsDraftEmpty", {
                  defaultValue: "Add studies from the package menu or catalog.",
                })}
              </p>
            ) : null}

            {draft.length > 0 ? (
              <ul className="space-y-1.5">
                {draft.map((row) => {
                  const sched =
                    row.kind === "visit"
                      ? parseDraftSchedule(row.scheduledAt)
                      : { date: "", time: "" };
                  const bal = studyBalances.find(
                    (b) => b.procedureCode === row.serviceCode,
                  );
                  const inQuota = bal ? Math.min(row.qty, bal.remaining) : 0;
                  const paid = Math.max(0, row.qty - inQuota);
                  return (
                    <li
                      key={row.key}
                      className={`${CARD_CONTAINER_CLASS} space-y-2 px-3 py-2 text-[13px]`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{row.title}</div>
                          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                            {row.serviceCode}
                            {inQuota > 0
                              ? ` · ${t("diagnosticsPackageBurn", {
                                  defaultValue: "package",
                                })} ${inQuota}`
                              : ""}
                            {paid > 0
                              ? ` · ${t("diagnosticsPaidOverflow", {
                                  defaultValue: "paid",
                                })} ${paid}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy || row.qty <= 1}
                            onClick={() =>
                              setDraft((prev) =>
                                prev.map((d) =>
                                  d.key === row.key
                                    ? { ...d, qty: Math.max(1, d.qty - 1) }
                                    : d,
                                ),
                              )
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[1.5rem] text-center">{row.qty}</span>
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() =>
                              setDraft((prev) =>
                                prev.map((d) =>
                                  d.key === row.key ? { ...d, qty: d.qty + 1 } : d,
                                ),
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() =>
                              setDraft((prev) => prev.filter((d) => d.key !== row.key))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {row.kind === "visit" ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <DatePicker
                            label={t("visitDate", { defaultValue: "Date" })}
                            value={sched.date || todayBakuYmd()}
                            onChange={(v) =>
                              patchDraftSchedule(
                                row.key,
                                v || todayBakuYmd(),
                                sched.time,
                              )
                            }
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
                            onChange={(e) =>
                              patchDraftSchedule(
                                row.key,
                                sched.date || todayBakuYmd(),
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {pending.length > 0 ? (
              <section className="space-y-1.5">
                <h4 className="text-sm font-medium">
                  {t("diagnosticsAwaitingTickets", {
                    defaultValue: "Awaiting payment (Extra tickets)",
                  })}
                </h4>
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {t("pendingPayTicketsHint", {
                    defaultValue: "Pay on Extra tickets — not here.",
                  })}
                </p>
                <ul className="space-y-1.5">
                  {pending.map((row) => (
                    <li
                      key={`${row.kind}-${row.id}`}
                      className={`${CARD_CONTAINER_CLASS} border border-red-100 bg-red-50/60 px-3 py-2 text-[13px]`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{row.title}</div>
                          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                            {row.amountNet.toFixed(2)} AZN ·{" "}
                            {t("pendingPay", { defaultValue: "Awaiting payment" })}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={readOnly || busy}
                          onClick={() => void removePending(row)}
                          aria-label={tc("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
