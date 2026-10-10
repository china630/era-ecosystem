"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
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
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: string;
  patientRefId: string;
  patientName: string;
  refCode: string;
  status?: string;
};

type PatientGroup = {
  patientRefId: string;
  patientName: string;
  refCode: string;
  items: ExtraRow[];
  total: number;
};

export default function ExtraTicketsPage() {
  const t = useTranslations("extraTickets");
  const tc = useTranslations("common");
  const [dualRun, setDualRun] = useState(false);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lockHint, setLockHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState("");
  const qDebounced = useDebouncedValue(q, 300);

  async function load() {
    const res = await fetch("/api/procedures/issue-ticket");
    const d = await res.json();
    const payload = d.data ?? d;
    setDualRun(!!payload.dualRun);
    setRows((payload.orders ?? []) as ExtraRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const originOptions = useMemo(
    () => [
      { value: "IN_HOUSE", label: t("origin_IN_HOUSE") },
      { value: "WALK_IN", label: t("origin_WALK_IN") },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const needle = qDebounced.trim().toLowerCase();
    return rows.filter((r) => {
      if (origin && r.patientOrigin !== origin) return false;
      if (!needle) return true;
      const hay = `${r.patientName} ${r.refCode} ${r.procedureName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, origin, qDebounced]);

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
      out.push({
        patientRefId,
        patientName: first.patientName,
        refCode: first.refCode,
        items,
        total: items.reduce((sum, row) => sum + Number(row.amountNet || 0), 0),
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
    const ids = group.items.map((row) => row.id);
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
    setOrigin("");
  }

  async function issue(orderIds: string[]) {
    if (!orderIds.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/procedures/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds,
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
      for (const path of printPaths.length ? printPaths : printPath ? [printPath] : []) {
        const base = path.includes("?") ? `${path}&sheets=1` : `${path}?sheets=1`;
        for (let i = 0; i < 3; i++) {
          window.open(`${base}&copy=${i + 1}`, `_blank_ticket_${Date.now()}_${i}`);
        }
      }
      setSelected(new Set());
      setLockHint(false);
      const receiptNo = payload.paymentReceiptRef as string | undefined;
      if (receiptNo) showSuccess(t("receiptIssued", { no: receiptNo }));
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
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy || selected.size === 0}
                    onClick={() => void issue([...selected])}
                  >
                    {t("pay")}
                  </button>
                </div>
            }
          >
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
          </EraListFilterBar>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("patient")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedure")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("amount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("origin")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {rows.length === 0 ? t("empty") : t("noMatch")}
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const ids = group.items.map((row) => row.id);
                  const selectedCount = ids.filter((id) => selected.has(id)).length;
                  const allOn = selectedCount === ids.length && ids.length > 0;
                  const someOn = selectedCount > 0 && !allOn;
                  const locked = patientLocked(group.patientRefId);
                  const open = expanded.has(group.patientRefId);
                  return (
                    <PatientBlock
                      key={group.patientRefId}
                      group={group}
                      open={open}
                      allOn={allOn}
                      someOn={someOn}
                      locked={locked}
                      busy={busy}
                      selected={selected}
                      patientLabel={t("selectPatient")}
                      procedureCountLabel={t("procedureCount", { count: group.items.length })}
                      payLabel={t("pay")}
                      payRowLabel={t("payRow")}
                      originLabel={originLabel}
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
                    />
                  );
                })
              )}
            </tbody>
          </table>
        }
      />
    </div>
  );
}

function PatientBlock({
  group,
  open,
  allOn,
  someOn,
  locked,
  busy,
  selected,
  patientLabel,
  procedureCountLabel,
  payLabel,
  payRowLabel,
  originLabel,
  onTogglePatient,
  onToggleExpanded,
  onToggleProcedure,
  onPay,
}: {
  group: PatientGroup;
  open: boolean;
  allOn: boolean;
  someOn: boolean;
  locked: boolean;
  busy: boolean;
  selected: Set<string>;
  patientLabel: string;
  procedureCountLabel: string;
  payLabel: string;
  payRowLabel: string;
  originLabel: (code: string) => string;
  onTogglePatient: () => void;
  onToggleExpanded: () => void;
  onToggleProcedure: (row: ExtraRow) => void;
  onPay: (id: string) => void;
}) {
  return (
    <>
      <tr className={locked ? `${DATA_TABLE_TR_CLASS} opacity-60` : DATA_TABLE_TR_CLASS}>
        <td className={DATA_TABLE_TD_CLASS}>
          <input
            ref={(el) => {
              if (el) el.indeterminate = someOn;
            }}
            type="checkbox"
            checked={allOn}
            disabled={busy}
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
        <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>{procedureCountLabel}</td>
        <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
          {group.total.toFixed(2)} AZN
        </td>
        <td className={DATA_TABLE_TD_CLASS} />
        <td className={DATA_TABLE_TD_CLASS} />
      </tr>
      {open
        ? group.items.map((row) => (
            <tr key={row.id} className={locked ? `${DATA_TABLE_TR_CLASS} opacity-60` : DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS} />
              <td className={DATA_TABLE_TD_CLASS}>
                <input
                  type="checkbox"
                  className="ml-6"
                  checked={selected.has(row.id)}
                  disabled={busy}
                  aria-label={payLabel}
                  onChange={() => onToggleProcedure(row)}
                />
              </td>
              <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                {Number(row.amountNet).toFixed(2)} AZN
              </td>
              <td className={DATA_TABLE_TD_CLASS}>{originLabel(row.patientOrigin)}</td>
              <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
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
              </td>
            </tr>
          ))
        : null}
    </>
  );
}
