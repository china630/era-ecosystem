"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote } from "lucide-react";
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
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";

type ExtraRow = {
  id: string;
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: string;
  patientName: string;
  refCode: string;
  status?: string;
};

export default function ExtraTicketsPage() {
  const t = useTranslations("extraTickets");
  const tc = useTranslations("common");
  const [dualRun, setDualRun] = useState(false);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptRef, setReceiptRef] = useState("");
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

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
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
    if (!receiptRef.trim()) {
      setError(t("receiptRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/procedures/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds,
          paymentReceiptRef: receiptRef.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || t("issueFailed"));
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
      setReceiptRef("");
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
      <PageHeader className="!mb-0" title={t("title")} subtitle={dualRun ? t("dualRunOn") : t("dualRunOff")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc("filterReset")}
            onReset={resetFilters}
            actionsExtra={
              <div className="flex flex-wrap items-end gap-2">
                <Field
                  label={t("receiptRef")}
                  preset="shortText"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder={t("receiptPlaceholder")}
                />
                <div className="flex flex-col items-end gap-1 pb-0.5">
                  {selected.size > 0 ? (
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {t("selectedTotal")}: {selectedTotal.toFixed(2)} AZN
                    </p>
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
        toolbar={
          error ? <p className={`px-1 text-sm ${TEXT_DANGER_CLASS}`}>{error}</p> : null
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visibleIds.length === 0}
                    onChange={toggleAllVisible}
                    aria-label={t("selectAll")}
                  />
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("patient")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedure")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("amount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("origin")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {rows.length === 0 ? t("empty") : t("noMatch")}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={t("pay")}
                      />
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="font-medium">{r.patientName}</div>
                      <div className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{r.refCode}</div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.procedureName}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                      {Number(r.amountNet).toFixed(2)} AZN
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{originLabel(r.patientOrigin)}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        disabled={busy}
                        aria-label={t("payRow")}
                        title={t("payRow")}
                        onClick={() => void issue([r.id])}
                      >
                        <Banknote className={`h-4 w-4 ${TEXT_SUCCESS_CLASS}`} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        }
      />
    </div>
  );
}
