"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, ChevronDown, ChevronRight, Printer, Trash2 } from "lucide-react";
import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";
import { OccupiedRoomFilter } from "@/components/sanatorium/OccupiedRoomFilter";
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from "@era/satellite-kit/ui";

type ExtraRow = {
  id: string;
  kind?: "procedure" | "lab" | "visit";
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: string;
  extraTicketIssuedAt?: string | null;
  resourceId?: string | null;
  patientRefId: string;
  patientName: string;
  refCode: string;
  roomNumber?: string | null;
  clinicalEpisodeId?: string | null;
  status?: string;
  bucket?: "due" | "overdue" | "noshow" | "issued";
  printPath?: string | null;
};

type ListScope = "due" | "overdue" | "noshow" | "issued" | "all";

const UNPAID_ROW_CLASS =
  "border-b border-[#D5DADF] bg-white transition-colors hover:bg-[#F1F5F9]";
const PAID_ROW_CLASS =
  "border-b border-[#D5DADF] bg-amber-50 transition-colors hover:bg-amber-100";

function extraRowClass(paid: boolean, locked: boolean): string {
  return [paid ? PAID_ROW_CLASS : UNPAID_ROW_CLASS, locked ? "opacity-60" : ""]
    .filter(Boolean)
    .join(" ");
}

type PatientGroup = {
  patientRefId: string;
  patientName: string;
  refCode: string;
  roomNumber: string;
  items: ExtraRow[];
  total: number;
};

export default function ExtraTicketsPage() {
  const t = useTranslations("extraTickets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [dualRun, setDualRun] = useState(false);
  const [needsFilter, setNeedsFilter] = useState(false);
  const [needsDates, setNeedsDates] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [scope, setScope] = useState<ListScope>("due");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lockHint, setLockHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelAskId, setCancelAskId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [room, setRoom] = useState("");
  const [origin, setOrigin] = useState("");
  const qDebounced = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ locale, scope });
    if (room.trim()) params.set("room", room.trim());
    if (qDebounced.trim()) params.set("q", qDebounced.trim());
    if (scope !== "due") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    const res = await fetch(`/api/procedures/issue-ticket?${params}`);
    const d = await res.json();
    const payload = d.data ?? d;
    setDualRun(!!payload.dualRun);
    setNeedsFilter(!!payload.needsFilter);
    setNeedsDates(!!payload.needsDates);
    setTruncated(!!payload.truncated);
    setRows((payload.orders ?? []) as ExtraRow[]);
  }, [locale, room, qDebounced, scope, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const originOptions = useMemo(
    () => [
      { value: "IN_HOUSE", label: t("origin_IN_HOUSE") },
      { value: "WALK_IN", label: t("origin_WALK_IN") },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const needle = qDebounced.trim().toLowerCase();
    const roomNeedle = room.trim().toLowerCase();
    return rows.filter((r) => {
      if (origin && r.patientOrigin !== origin) return false;
      if (roomNeedle && (r.roomNumber ?? "").trim().toLowerCase() !== roomNeedle) return false;
      if (!needle) return true;
      const hay = `${r.patientName} ${r.refCode} ${r.procedureName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, origin, qDebounced, room]);

  const groups = useMemo(() => {
    const map = new Map<string, ExtraRow[]>();
    for (const row of filtered) {
      const key = row.patientRefId || row.refCode;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    const out: PatientGroup[] = [];
    for (const [patientRefId, items] of map) {
      const first = items[0]!;
      const allIssued = items.every((item) => item.bucket === "issued");
      out.push({
        patientRefId,
        patientName: first.patientName,
        refCode: first.refCode,
        roomNumber: [...new Set(items.map((row) => row.roomNumber?.trim()).filter(Boolean))].join(", "),
        items,
        total: items.reduce((sum, row) => {
          if (row.bucket === "issued" && !allIssued) return sum;
          return sum + Number(row.amountNet || 0);
        }, 0),
      });
    }
    return out;
  }, [filtered]);

  const lockedPatientId = useMemo(() => {
    for (const row of rows) {
      if (selected.has(row.id)) return row.patientRefId || row.refCode;
    }
    return null;
  }, [rows, selected]);

  function patientLocked(patientRefId: string): boolean {
    return lockedPatientId != null && lockedPatientId !== patientRefId;
  }

  function toggleProcedure(row: ExtraRow) {
    const key = row.patientRefId || row.refCode;
    if (patientLocked(key)) {
      setLockHint(true);
      return;
    }
    setLockHint(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  function togglePatient(group: PatientGroup) {
    if (patientLocked(group.patientRefId)) {
      setLockHint(true);
      return;
    }
    setLockHint(false);
    const ids = group.items
      .filter((row) => row.bucket === "due" || row.bucket === "overdue" || !row.bucket)
      .map((row) => row.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  function toggleExpanded(patientRefId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(patientRefId)) next.delete(patientRefId);
      else next.add(patientRefId);
      return next;
    });
  }

  const selectedTotal = useMemo(() => {
    return rows
      .filter((r) => selected.has(r.id))
      .reduce((s, r) => s + Number(r.amountNet || 0), 0);
  }, [rows, selected]);

  function resetFilters() {
    setQ("");
    setRoom("");
    setOrigin("");
    setScope("due");
    setDateFrom("");
    setDateTo("");
  }

  function changeScope(next: ListScope) {
    setScope(next);
    setSelected(new Set());
    if (next === "due") return;
    const today = todayBakuYmd();
    if (!dateFrom || !dateTo) {
      if (next === "overdue") {
        setDateFrom(addBakuDays(today, -30));
        setDateTo(addBakuDays(today, -1));
      } else {
        setDateFrom(today);
        setDateTo(today);
      }
    }
  }

  const payable = scope === "due" || scope === "overdue" || scope === "all";
  const scopeOptions = useMemo(
    () =>
      (["due", "overdue", "noshow", "issued", "all"] as const).map((id) => ({
        value: id,
        label: t(`scope.${id}`),
      })),
    [t],
  );

  async function issue(orderIds: string[]) {
    if (!orderIds.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/procedures/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds,
          locale,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        const code = typeof d?.code === "string" ? d.code : "";
        if (code === "MIXED_PATIENT") {
          showApiError({ error: t("mixedPatient") }, t("issueFailed"));
        } else {
          showApiError(d, t("issueFailed"));
        }
        return;
      }
      const payload = d.data ?? d;
      const printPaths = (payload.printPaths as string[] | undefined) ?? [];
      const printPath = (payload.printPath as string | undefined) ?? printPaths[0];
      const seen = new Set<string>();
      for (const path of printPaths.length ? printPaths : printPath ? [printPath] : []) {
        if (seen.has(path)) continue;
        seen.add(path);
        const withLang = path.includes("lang=")
          ? path
          : `${path}${path.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}`;
        const base = withLang.includes("sheets=") ? withLang : `${withLang}&sheets=1`;
        const ticket = decodeURIComponent(base.split("/print/extra-ticket/")[1]?.split("?")[0] ?? "ticket").replace(
          /[^a-zA-Z0-9_-]/g,
          "_",
        );
        for (let i = 0; i < 3; i++) {
          window.open(`${base}&copy=${i + 1}`, `extra_ticket_${ticket}_copy_${i + 1}`);
        }
      }
      setSelected(new Set());
      setLockHint(false);
      const accepted = (payload.accepted as { name: string }[] | undefined) ?? [];
      const rejected = (payload.rejected as { name: string; reason?: string }[] | undefined) ?? [];
      if (accepted.length || rejected.length) {
        const okNames = accepted.map((row) => row.name).join(", ");
        const badNames = rejected
          .map((row) => (row.reason ? `${row.name} (${row.reason})` : row.name))
          .join(", ");
        showSuccess(
          [
            okNames ? t("batchFolio", { names: okNames }) : "",
            badNames ? t("batchCashier", { names: badNames }) : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      } else {
        const receiptNo = payload.paymentReceiptRef as string | undefined;
        if (receiptNo) showSuccess(t("receiptIssued", { no: receiptNo }));
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelRow(id: string) {
    setCancelAskId(null);
    setBusy(true);
    try {
      const row = rows.find((r) => r.id === id);
      const kind = row?.kind ?? "procedure";
      let res: Response;
      if ((kind === "lab" || kind === "visit") && row?.clinicalEpisodeId) {
        res = await fetch(
          `/api/sanatorium/episodes/${encodeURIComponent(row.clinicalEpisodeId)}/diagnostics-extras?id=${encodeURIComponent(id)}&kind=${kind}`,
          { method: "DELETE" },
        );
      } else {
        res = await fetch(`/api/procedures/${id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "reception_unpaid_cancel" }),
        });
      }
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("cancelFailed"));
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function originLabel(code: string): string {
    if (code === "IN_HOUSE") return t("origin_IN_HOUSE");
    if (code === "WALK_IN") return t("origin_WALK_IN");
    return code;
  }

  function kindLabel(kind?: ExtraRow["kind"]): string {
    if (kind === "lab") return t("kind_lab");
    if (kind === "visit") return t("kind_visit");
    return t("kind_procedure");
  }

  const cancelAskRow = cancelAskId ? rows.find((row) => row.id === cancelAskId) : null;
  const cancelAskIsDiagnostic =
    cancelAskRow?.kind === "lab" || cancelAskRow?.kind === "visit";

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={dualRun ? t("dualRunOn") : t("dualRunOff")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={tc("filterReset")}
            onReset={resetFilters}
            actionsExtra={
              <div className="flex flex-col items-end gap-1 pb-0.5">
                  {selected.size > 0 ? (
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {t("selectedTotal")}: {selectedTotal.toFixed(2)} AZN
                    </p>
                  ) : null}
                  {lockHint ? (
                    <p className="max-w-xs text-right text-[12px] text-amber-800">{t("mixedPatient")}</p>
                  ) : null}
                  {payable ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy || selected.size === 0}
                      onClick={() => void issue([...selected])}
                    >
                      {t("pay")}
                    </button>
                  ) : null}
                </div>
            }
          >
            <OccupiedRoomFilter
              label={t("filterRoom")}
              value={room}
              onChange={setRoom}
              allLabel={tc("all")}
            />
            <Field
              label={t("filterSearch")}
              preset="shortText"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("filterSearchPlaceholder")}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("origin")}
              value={origin}
              onChange={(v) => setOrigin(String(v ?? ""))}
              options={originOptions}
              emptyLabel={tc("all")}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterScope")}
              value={scope}
              onChange={(v) => changeScope((v as ListScope) || "due")}
              options={scopeOptions}
            />
            {scope !== "due" ? (
              <>
                <DatePicker
                  label={t("filterDateFrom")}
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder={tc("datePlaceholder")}
                  openCalendarLabel={tc("openCalendar")}
                />
                <DatePicker
                  label={t("filterDateTo")}
                  value={dateTo}
                  onChange={setDateTo}
                  placeholder={tc("datePlaceholder")}
                  openCalendarLabel={tc("openCalendar")}
                />
              </>
            ) : null}
          </EraListFilterBar>
        }
        table={
          <>
            {truncated ? (
              <p className={`px-3 py-2 text-[12px] text-amber-800`}>{t("listTruncated")}</p>
            ) : null}
            <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("patient")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("filterRoom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("when")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("paidAt")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedure")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("amount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("origin")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr className={UNPAID_ROW_CLASS}>
                  <td colSpan={9} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {needsFilter
                      ? t("pickRoomOrName")
                      : needsDates
                        ? t("pickDates")
                        : rows.length === 0
                          ? t("empty")
                          : t("noMatch")}
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const ids = group.items
                    .filter(
                      (row) =>
                        payable &&
                        (row.bucket === "due" || row.bucket === "overdue" || !row.bucket),
                    )
                    .map((row) => row.id);
                  const selectedCount = ids.filter((id) => selected.has(id)).length;
                  const allOn = selectedCount === ids.length && ids.length > 0;
                  const someOn = selectedCount > 0 && !allOn;
                  const locked = patientLocked(group.patientRefId);
                  const allPaid =
                    group.items.length > 0 && group.items.every((row) => row.bucket === "issued");
                  const open = expanded.has(group.patientRefId);
                  return (
                    <PatientBlock
                      key={group.patientRefId}
                      group={group}
                      open={open}
                      allOn={allOn}
                      someOn={someOn}
                      locked={locked}
                      allPaid={allPaid}
                      busy={busy}
                      selected={selected}
                      patientLabel={t("selectPatient")}
                      procedureCountLabel={t("procedureCount", { count: group.items.length })}
                      payLabel={t("pay")}
                      payRowLabel={t("payRow")}
                      reprintLabel={t("reprint")}
                      cancelRowLabel={t("cancelRow")}
                      canSelect={ids.length > 0}
                      originLabel={originLabel}
                      kindLabel={kindLabel}
                      bucketLabel={(bucket) => (bucket ? t(`bucket.${bucket}`) : "")}
                      showBucket={scope !== "due"}
                      rowPayable={(row) =>
                        payable && (row.bucket === "due" || row.bucket === "overdue" || !row.bucket)
                      }
                      onTogglePatient={() => togglePatient(group)}
                      onToggleExpanded={() => toggleExpanded(group.patientRefId)}
                      onToggleProcedure={toggleProcedure}
                      onPay={(id) => {
                        if (locked) {
                          setLockHint(true);
                          return;
                        }
                        void issue([id]);
                      }}
                      onCancel={setCancelAskId}
                      onReprint={(path) => {
                        window.open(path, "_blank", "noopener");
                      }}
                    />
                  );
                })
              )}
            </tbody>
          </table>
          </>
        }
      />
      <ModalShell
        open={Boolean(cancelAskId)}
        title={t("cancelRow")}
        onClose={() => setCancelAskId(null)}
        footer={
          <ModalFooter
            onCancel={() => setCancelAskId(null)}
            onSubmit={() => {
              if (cancelAskId) void cancelRow(cancelAskId);
            }}
            busy={busy}
            submitLabel={t("cancelRow")}
          />
        }
      >
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
          {cancelAskIsDiagnostic ? t("confirmCancelDiagnostic") : t("confirmCancel")}
        </p>
      </ModalShell>
    </div>
  );
}

function PatientBlock({
  group,
  open,
  allOn,
  someOn,
  locked,
  allPaid,
  busy,
  selected,
  patientLabel,
  procedureCountLabel,
  payLabel,
  payRowLabel,
  reprintLabel,
  cancelRowLabel,
  canSelect,
  originLabel,
  kindLabel,
  bucketLabel,
  showBucket,
  rowPayable,
  onTogglePatient,
  onToggleExpanded,
  onToggleProcedure,
  onPay,
  onCancel,
  onReprint,
}: {
  group: PatientGroup;
  open: boolean;
  allOn: boolean;
  someOn: boolean;
  locked: boolean;
  allPaid: boolean;
  busy: boolean;
  selected: Set<string>;
  patientLabel: string;
  procedureCountLabel: string;
  payLabel: string;
  payRowLabel: string;
  reprintLabel: string;
  cancelRowLabel: string;
  canSelect: boolean;
  originLabel: (code: string) => string;
  kindLabel: (kind?: ExtraRow["kind"]) => string;
  bucketLabel: (bucket?: ExtraRow["bucket"]) => string;
  showBucket: boolean;
  rowPayable: (row: ExtraRow) => boolean;
  onTogglePatient: () => void;
  onToggleExpanded: () => void;
  onToggleProcedure: (row: ExtraRow) => void;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onReprint: (path: string) => void;
}) {
  return (
    <>
      <tr className={extraRowClass(allPaid, locked)}>
        <td className={DATA_TABLE_TD_CLASS}>
          <input
            ref={(el) => {
              if (el) el.indeterminate = someOn;
            }}
            type="checkbox"
            checked={allOn}
            disabled={busy || !canSelect}
            aria-label={patientLabel}
            onChange={onTogglePatient}
          />
        </td>
        <td className={DATA_TABLE_TD_CLASS}>
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={onToggleExpanded}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
            )}
            <span>
              <span className="font-medium">{group.patientName}</span>
              <span className={`ml-2 text-[11px] ${TEXT_MUTED_CLASS}`}>{group.refCode}</span>
            </span>
          </button>
        </td>
        <td className={DATA_TABLE_TD_CLASS}>{group.roomNumber || "—"}</td>
        <td className={DATA_TABLE_TD_CLASS} />
        <td className={DATA_TABLE_TD_CLASS} />
        <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>{procedureCountLabel}</td>
        <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
          {group.total.toFixed(2)} AZN
        </td>
        <td className={DATA_TABLE_TD_CLASS} />
        <td className={DATA_TABLE_TD_CLASS} />
      </tr>
      {open
        ? group.items.map((row) => (
            <tr key={row.id} className={extraRowClass(row.bucket === "issued", locked)}>
              <td className={DATA_TABLE_TD_CLASS} />
              <td className={DATA_TABLE_TD_CLASS}>
                {rowPayable(row) ? (
                  <input
                    type="checkbox"
                    className="ml-6"
                    checked={selected.has(row.id)}
                    disabled={busy}
                    aria-label={payLabel}
                    onChange={() => onToggleProcedure(row)}
                  />
                ) : null}
              </td>
              <td className={DATA_TABLE_TD_CLASS}>{row.roomNumber || "—"}</td>
              <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap tabular-nums`}>
                {row.scheduledAt ? bakuDateTimeDisplay(row.scheduledAt) : "—"}
              </td>
              <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap tabular-nums`}>
                {row.extraTicketIssuedAt ? bakuDateTimeDisplay(row.extraTicketIssuedAt) : "—"}
              </td>
              <td className={DATA_TABLE_TD_CLASS}>
                <span className={`mr-2 text-[11px] uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                  {kindLabel(row.kind)}
                </span>
                {showBucket && row.bucket ? (
                  <span className="mr-2 text-[11px] text-amber-800">{bucketLabel(row.bucket)}</span>
                ) : null}
                {row.procedureName}
              </td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                {Number(row.amountNet).toFixed(2)} AZN
              </td>
              <td className={DATA_TABLE_TD_CLASS}>{originLabel(row.patientOrigin)}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                {rowPayable(row) ? (
                  <>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      disabled={busy}
                      aria-label={payRowLabel}
                      title={payRowLabel}
                      onClick={() => onPay(row.id)}
                    >
                      <Banknote className={`h-4 w-4 ${TEXT_SUCCESS_CLASS}`} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      disabled={busy}
                      aria-label={cancelRowLabel}
                      title={cancelRowLabel}
                      onClick={() => onCancel(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                    </button>
                  </>
                ) : null}
                {row.printPath ? (
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={reprintLabel}
                    title={reprintLabel}
                    onClick={() => onReprint(row.printPath!)}
                  >
                    <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
                  </button>
                ) : null}
              </td>
            </tr>
          ))
        : null}
    </>
  );
}
