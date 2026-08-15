"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Printer, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SCROLL_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  FieldSelect,
  ListPaginationFooter,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { CashierSettleModal } from "@/components/CashierSettleModal";

type Tab = "queue" | "history" | "overQuota";

type ShiftInfo = {
  id: string;
  code: string;
  status: string;
  openedAt: string;
};

type ShiftReport = {
  receiptCount: number;
  voidCount: number;
  amountNet: number;
  byMethod: Record<string, { count: number; amount: number }>;
  byChannel: Record<string, { count: number; amount: number }>;
};

type QueueRow = {
  visitId: string;
  patientRef: { id: string; refCode: string; fullName: string };
  patientOrigin: string;
  channel: string;
  completedAt: string | null;
  amountNet: number;
  amountGross: number;
  lineCount: number;
  roomNumber: string | null;
};

type ReceiptRow = {
  id: string;
  status: string;
  channel: string;
  amountNet: string | number;
  createdAt: string;
  reprintCount: number;
  patientRef?: { refCode: string; fullName: string } | null;
  fiscalReceiptId?: string | null;
};

type ChargeLogRow = {
  id: string;
  procedureCode: string;
  procedureName: string;
  amountNet: string | number;
  overQuota: boolean;
  channel: string;
  settledLocally: boolean;
  createdAt: string;
  patientRef: { refCode: string; fullName: string };
};

type PatientOption = { id: string; refCode: string; fullName: string };

type Filters = {
  dateFrom: string;
  dateTo: string;
  patientRefId: string;
  origin: string;
  channel: string;
  status: string;
};

const emptyFilters: Filters = {
  dateFrom: "",
  dateTo: "",
  patientRefId: "",
  origin: "",
  channel: "",
  status: "",
};

export default function CashierPage() {
  const t = useTranslations("cashier");
  const tc = useTranslations("common");
  const params = useSearchParams();
  const deepVisit = params.get("visitId");

  const [tab, setTab] = useState<Tab>("queue");
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [hubActive, setHubActive] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [charges, setCharges] = useState<ChargeLogRow[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [settleVisitId, setSettleVisitId] = useState<string | null>(deepVisit);
  const [zSnapshot, setZSnapshot] = useState<ShiftReport | null>(null);

  function patchFilters(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const loadShift = useCallback(async () => {
    const res = await fetch("/api/cashier/shifts/current");
    if (!res.ok) return;
    const d = await res.json();
    const payload = d.data ?? d;
    setShift(payload.shift ?? null);
    setReport(payload.report ?? null);
  }, []);

  const loadPatients = useCallback(async () => {
    const res = await fetch("/api/patients?pageSize=100");
    if (!res.ok) return;
    const d = await res.json();
    const list = (d.items ?? d.data?.items ?? d.data ?? []) as PatientOption[];
    setPatients(Array.isArray(list) ? list : []);
  }, []);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.dateFrom) qs.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) qs.set("dateTo", filters.dateTo);
      if (filters.patientRefId) qs.set("patientRefId", filters.patientRefId);

      if (tab === "queue") {
        if (filters.origin) qs.set("origin", filters.origin);
        if (filters.channel) qs.set("channel", filters.channel);
        const res = await fetch(`/api/cashier/queue?${qs}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? t("loadFailed"));
        const payload = d.data ?? d;
        setQueue(payload.data ?? []);
        setTotal(payload.total ?? 0);
      } else if (tab === "history") {
        if (filters.status) qs.set("status", filters.status);
        if (shift?.id) qs.set("shiftId", "");
        const res = await fetch(`/api/cashier/receipts?${qs}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? t("loadFailed"));
        const payload = d.data ?? d;
        setReceipts(payload.data ?? []);
        setTotal(payload.total ?? 0);
      } else {
        qs.set("unsettledOnly", "true");
        qs.set("overQuotaOnly", "true");
        const res = await fetch(`/api/cashier/over-quota?${qs}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? t("loadFailed"));
        const payload = d.data ?? d;
        setCharges(payload.data ?? []);
        setTotal(payload.total ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, filters, shift?.id, t]);

  useEffect(() => {
    void loadShift();
    void loadPatients();
    void fetch("/api/billing/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHubActive(Boolean(data?.deferWalkInToHub)))
      .catch(() => setHubActive(false));
  }, [loadShift, loadPatients]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  useEffect(() => {
    if (deepVisit) setSettleVisitId(deepVisit);
  }, [deepVisit]);

  async function openShift() {
    const res = await fetch("/api/cashier/shifts/current", { method: "POST" });
    const d = await res.json();
    const payload = d.data ?? d;
    setShift(payload.shift ?? null);
    setReport(payload.report ?? null);
  }

  async function closeShift() {
    if (!shift) return;
    const res = await fetch(`/api/cashier/shifts/${shift.id}/close`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("closeShiftFailed"));
      return;
    }
    const payload = d.data ?? d;
    setZSnapshot(payload.report ?? null);
    setShift(null);
    setReport(null);
  }

  async function voidReceipt(id: string) {
    const reason = window.prompt(t("voidReasonPrompt"));
    if (!reason || reason.trim().length < 3) return;
    const res = await fetch(`/api/cashier/receipts/${id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? t("voidFailed"));
      return;
    }
    void loadTab();
    void loadShift();
  }

  async function reprint(id: string) {
    await fetch(`/api/cashier/receipts/${id}/reprint`, { method: "POST" });
    void loadTab();
  }

  async function settleOverQuota(id: string) {
    if (!shift) {
      setError(t("needOpenShift"));
      return;
    }
    const res = await fetch(`/api/cashier/over-quota/${id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? t("paymentFailed"));
      return;
    }
    void loadTab();
    void loadShift();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "queue", label: t("tabQueue") },
    { id: "history", label: t("tabHistory") },
    { id: "overQuota", label: t("tabOverQuota") },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          {shift ? (
            <>
              <p className="text-sm">
                {t("shiftOpen")}: <strong>{shift.code}</strong>
              </p>
              {report && (
                <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
                  {t("xReport")}: {report.receiptCount} / {report.amountNet.toFixed(2)} AZN
                </p>
              )}
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void closeShift()}>
                {t("closeShift")}
              </button>
            </>
          ) : (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openShift()}>
              {t("openShift")}
            </button>
          )}
        </div>
        {zSnapshot && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="font-medium">{t("zReport")}</p>
            <p>
              {t("receipts")}: {zSnapshot.receiptCount}, {t("voids")}: {zSnapshot.voidCount},{" "}
              {t("net")}: {zSnapshot.amountNet.toFixed(2)} AZN
            </p>
          </div>
        )}
        {hubActive && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t("hubBanner")}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={tab === tb.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setTab(tb.id);
              setPage(1);
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setFilters(emptyFilters);
          setPage(1);
        }}
      >
        <DatePicker
          label={t("filterDateFrom")}
          value={filters.dateFrom}
          onChange={(v) => patchFilters({ dateFrom: v })}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <DatePicker
          label={t("filterDateTo")}
          value={filters.dateTo}
          onChange={(v) => patchFilters({ dateTo: v })}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <FieldSelect
          label={t("filterPatient")}
          preset="select"
          value={filters.patientRefId}
          onChange={(e) => patchFilters({ patientRefId: e.target.value })}
        >
          <option value="">{tc("all")}</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} ({p.refCode})
            </option>
          ))}
        </FieldSelect>
        {tab === "queue" && (
          <>
            <FieldSelect
              label={t("filterOrigin")}
              preset="select"
              value={filters.origin}
              onChange={(e) => patchFilters({ origin: e.target.value })}
            >
              <option value="">{tc("all")}</option>
              <option value="WALK_IN">{t("origin.WALK_IN")}</option>
              <option value="IN_HOUSE">{t("origin.IN_HOUSE")}</option>
            </FieldSelect>
            <FieldSelect
              label={t("filterChannel")}
              preset="select"
              value={filters.channel}
              onChange={(e) => patchFilters({ channel: e.target.value })}
            >
              <option value="">{tc("all")}</option>
              <option value="LOCAL">{t("channel.LOCAL")}</option>
              <option value="HOTEL_FOLIO">{t("channel.HOTEL_FOLIO")}</option>
              <option value="SETTLEMENT_HUB">{t("channel.SETTLEMENT_HUB")}</option>
            </FieldSelect>
          </>
        )}
        {tab === "history" && (
          <FieldSelect
            label={t("filterStatus")}
            preset="select"
            value={filters.status}
            onChange={(e) => patchFilters({ status: e.target.value })}
          >
            <option value="">{tc("all")}</option>
            <option value="PAID">PAID</option>
            <option value="VOID">VOID</option>
          </FieldSelect>
        )}
      </EraListFilterBar>

      {error && <p className={`mb-2 text-sm ${TEXT_DANGER_CLASS}`}>{error}</p>}

      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className={DATA_TABLE_SCROLL_CLASS}>
          {loading ? (
            <p className={`p-4 text-sm ${TEXT_MUTED_CLASS}`}>{t("loading")}</p>
          ) : tab === "queue" ? (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCompleted")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrigin")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colChannel")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLines")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                      {t("emptyQueue")}
                    </td>
                  </tr>
                ) : (
                  queue.map((row) => (
                    <tr
                      key={row.visitId}
                      className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                      onClick={() => setSettleVisitId(row.visitId)}
                    >
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="font-medium">{row.patientRef.fullName}</div>
                        <div className={`text-xs ${TEXT_MUTED_CLASS}`}>{row.patientRef.refCode}</div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.completedAt ? new Date(row.completedAt).toLocaleString() : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.patientOrigin}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {t(`channel.${row.channel}` as "channel.LOCAL")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.amountNet.toFixed(2)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.lineCount}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={t("openBill")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettleVisitId(row.visitId);
                          }}
                        >
                          <Wallet className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : tab === "history" ? (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colReceipt")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colChannel")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                      {t("emptyHistory")}
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="font-medium">{r.patientRef?.fullName ?? "—"}</div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="font-mono text-xs">{r.id.slice(0, 10)}…</div>
                        <div className={`text-xs ${TEXT_MUTED_CLASS}`}>
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {t(`channel.${r.channel}` as "channel.LOCAL")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{Number(r.amountNet).toFixed(2)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={`${t("reprint")} (${r.reprintCount})`}
                            onClick={() => void reprint(r.id)}
                          >
                            <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
                          </button>
                          {r.status === "PAID" && r.channel === "LOCAL" && (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("void")}
                              onClick={() => void voidReceipt(r.id)}
                            >
                              <Ban className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colProcedure")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colChannel")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {charges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                      {t("emptyOverQuota")}
                    </td>
                  </tr>
                ) : (
                  charges.map((c) => (
                    <tr key={c.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {c.patientRef.fullName}
                        <div className={`text-xs ${TEXT_MUTED_CLASS}`}>{c.patientRef.refCode}</div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {c.procedureName}
                        <div className={`text-xs ${TEXT_MUTED_CLASS}`}>{c.procedureCode}</div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{c.channel}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{Number(c.amountNet).toFixed(2)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {(c.channel === "LOCAL" || c.channel === "WARN_ONLY") &&
                          !c.settledLocally && (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("settleLocal")}
                              onClick={() => void settleOverQuota(c.id)}
                            >
                              <Wallet className="h-4 w-4 text-[#27AE60]" aria-hidden />
                            </button>
                          )}
                        {c.channel === "HOTEL_FOLIO" && (
                          <span className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("chargedFolio")}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>

      <CashierSettleModal
        visitId={settleVisitId}
        shiftId={shift?.id ?? null}
        onClose={() => setSettleVisitId(null)}
        onSettled={() => {
          void loadTab();
          void loadShift();
        }}
      />
    </>
  );
}
