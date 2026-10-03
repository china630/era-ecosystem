"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";
import { MODAL_INPUT_CLASS, showApiError, showSuccess } from "@era/satellite-kit/ui";
import { bakuTimeLabel } from "@era/satellite-kit/time";
import { SaleTable, type SaleRowView, type SaleTotalsView } from "@/components/SaleTable";
import { CashDrawerBlock } from "@/components/CashDrawerBlock";
import type { CashDrawerView } from "@/lib/cash-drawer";

type OpenShift = {
  id: string;
  status: string;
  openingCash: string | number;
  openedAt: string;
  fiscalDeviceId?: string | null;
  bankTerminalId?: string | null;
  openedBy?: string | null;
  stale?: boolean;
  businessDayStart?: string;
  drawer?: CashDrawerView;
  till?: { cash: number; card: number; transfer: number; openChecks: number };
  outlet: { code: string; name: string };
};

type FiscalDevice = {
  id: string;
  kind: string;
  label: string;
  providerId: string;
};

export default function PosShiftPanel() {
  const t = useTranslations("shift");
  const tc = useTranslations("common");
  const [shift, setShift] = useState<OpenShift | null>(null);
  const [none, setNone] = useState(false);
  const [dayStart, setDayStart] = useState("05:00");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [outletCode, setOutletCode] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [kkms, setKkms] = useState<FiscalDevice[]>([]);
  const [banks, setBanks] = useState<FiscalDevice[]>([]);
  const [fiscalDeviceId, setFiscalDeviceId] = useState("");
  const [bankTerminalId, setBankTerminalId] = useState("");
  const [report, setReport] = useState<{ rows: SaleRowView[]; totals: SaleTotalsView } | null>(null);
  const [reportDrawer, setReportDrawer] = useState<CashDrawerView | null>(null);
  const [reportKind, setReportKind] = useState<"x" | "z">("x");
  const [closeModal, setCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [dropModal, setDropModal] = useState(false);
  const [dropAmount, setDropAmount] = useState("");
  const [dropNote, setDropNote] = useState("");
  const [canClose, setCanClose] = useState(false);
  const [canSales, setCanSales] = useState(false);
  const ts = useTranslations("sales");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const res = await fetch("/api/shifts/open");
    const data = await res.json().catch(() => null);
    setDayStart(typeof data?.businessDayStart === "string" ? data.businessDayStart : "05:00");
    setCanClose(res.ok && data?.mayClose === true);
    setCanSales(res.ok && data?.maySales === true);
    if (data?.status === "NONE" || !data?.id) {
      setShift(null);
      setNone(true);
    } else {
      setShift(data as OpenShift);
      setNone(false);
    }
    setLoading(false);
  }, []);

  const loadDevices = useCallback(async (outlet: string) => {
    const res = await fetch(
      `/api/fiscal/devices?outlet=${encodeURIComponent(outlet)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      devices?: FiscalDevice[];
      defaults?: { fiscalDeviceId?: string | null; bankTerminalId?: string | null };
    };
    const devices = data.devices ?? [];
    setKkms(devices.filter((d) => d.kind === "FISCAL_KKM"));
    setBanks(devices.filter((d) => d.kind === "BANK_POS"));
    if (data.defaults?.fiscalDeviceId) {
      setFiscalDeviceId(data.defaults.fiscalDeviceId);
    }
    if (data.defaults?.bankTerminalId) {
      setBankTerminalId(data.defaults.bankTerminalId);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load({ silent: true });
    window.addEventListener("era-fnb-shift-refresh", refresh);
    return () => window.removeEventListener("era-fnb-shift-refresh", refresh);
  }, [load]);

  useEffect(() => {
    void fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d?.outlets) ? d.outlets : [];
        const pick =
          list.find((o: { code: string }) => o.code === "KAFE") ??
          list.find((o: { code: string }) => o.code === "RESTAURANT") ??
          list[0];
        if (pick?.code) setOutletCode(pick.code);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (openModal) void loadDevices(outletCode.trim());
  }, [openModal, outletCode, loadDevices]);

  async function openShift() {
    setBusy(true);
    const res = await fetch("/api/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(outletCode.trim() ? { outletCode: outletCode.trim() } : {}),
        openingCash: Number(openingCash) || 0,
        ...(fiscalDeviceId ? { fiscalDeviceId } : {}),
        ...(bankTerminalId ? { bankTerminalId } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, t("openFailed"));
      return;
    }
    setOpenModal(false);
    showSuccess(t("opened"));
    await load();
  }

  async function closeShift() {
    setBusy(true);
    const res = await fetch("/api/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: shift?.id,
        countedCash: Number(countedCash),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (res.status === 403) {
        showApiError({ error: t("managerRequired") });
      } else if (res.status === 409) {
        showApiError({ error: t("openTicketsBlock", { count: data.openTickets ?? "?" }) });
      } else {
        showApiError(data, t("closeFailed"));
      }
      return;
    }
    showSuccess(t("closed"));
    setCloseModal(false);
    setCountedCash("");
    if (data.report?.rows && data.report?.totals) {
      setReportKind("z");
      setReport({ rows: data.report.rows, totals: data.report.totals });
      setReportDrawer(data.drawer ?? null);
    }
    await load();
  }

  async function saveDrop() {
    const amount = Number(dropAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showApiError({ error: t("dropAmount") });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/shifts/drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: shift?.id,
        amountAzn: amount,
        note: dropNote.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      if (res.status === 403) showApiError({ error: t("managerRequired") });
      else showApiError(data, t("closeFailed"));
      return;
    }
    setDropModal(false);
    setDropAmount("");
    setDropNote("");
    showSuccess(t("dropSaved"));
    await load();
  }

  async function showX() {
    const res = await fetch("/api/sales?scope=shift");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      showApiError(data, t("closeFailed"));
      return;
    }
    setReportKind("x");
    setReport({ rows: data.rows ?? [], totals: data.totals });
    setReportDrawer(Array.isArray(data.drawers) ? data.drawers[0] ?? null : null);
  }

  const drawerLabels = {
    title: t("drawerTitle"),
    opening: t("opening"),
    cashSales: t("cashSales"),
    drops: t("dropsTotal"),
    expected: t("expected"),
    counted: t("countedCash"),
    variance: t("variance"),
  };

  return (
    <div className={`${CARD_CLASS} mb-3 shrink-0 p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
          {loading ? (
            <p className="text-sm text-[#7F8C8D]">{tc("loading", { defaultValue: "Loading…" })}</p>
          ) : shift ? (
            <>
              <div className="min-w-[7rem]">
                <p className="text-sm font-semibold text-[#2C3E50]">{shift.outlet.code}</p>
                <p className="text-xs text-[#7F8C8D]">
                  {bakuTimeLabel(shift.openedAt)}
                  {shift.openedBy ? ` · ${shift.openedBy}` : ""}
                </p>
              </div>
              <div className="w-16 text-center">
                <p className="text-[11px] text-[#7F8C8D]">{t("float")}</p>
                <p className="text-sm font-semibold tabular-nums text-[#2C3E50]">
                  {Number(shift.openingCash).toFixed(2)}
                </p>
              </div>
              <div className="flex items-end gap-1">
                <span className="pb-0.5 text-[10px] text-[#7F8C8D]">{tc("azn")}</span>
                {(
                  [
                    [ts("cash"), shift.till?.cash],
                    [ts("card"), shift.till?.card],
                    [ts("transfer"), shift.till?.transfer],
                  ] as const
                ).map(([label, amount]) => (
                  <div key={label} className="w-16 text-center">
                    <p className="text-[11px] text-[#7F8C8D]">{label}</p>
                    <p className="text-sm font-semibold tabular-nums text-[#2C3E50]">
                      {(amount ?? 0).toFixed(2)}
                    </p>
                  </div>
                ))}
                <div className="w-14 text-center">
                  <p className="text-[11px] text-[#7F8C8D]">{t("openShort")}</p>
                  <p className="text-sm font-semibold tabular-nums text-[#2C3E50]">
                    {shift.till?.openChecks ?? 0}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("noShift")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!shift && none && (
            <button
              type="button"
              className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
              disabled={busy}
              onClick={() => setOpenModal(true)}
            >
              {t("openShift")}
            </button>
          )}
          {shift && canSales && (
            <button
              type="button"
              className="rounded border border-[#2980B9] px-3 py-1.5 text-sm text-[#2980B9]"
              onClick={() => void showX()}
            >
              {t("xReport")}
            </button>
          )}
          {shift && canClose && (
            <button
              type="button"
              className="rounded border border-[#34495E] px-3 py-1.5 text-sm text-[#34495E]"
              disabled={busy}
              onClick={() => setDropModal(true)}
            >
              {t("drop")}
            </button>
          )}
          <p className="self-center text-sm text-[#34495E]">{t("dayStart", { time: dayStart })}</p>
          {shift && canClose && (
            <button
              type="button"
              className="rounded border border-[#E74C3C] px-3 py-1.5 text-sm text-[#E74C3C]"
              disabled={busy}
              onClick={() => {
                setCountedCash("");
                setCloseModal(true);
              }}
            >
              {t("zClose")}
            </button>
          )}
          {shift?.stale ? (
            <p className="max-w-xs text-sm text-[#C0392B]">
              {t("staleNotice", { time: shift.businessDayStart ?? "05:00" })}
            </p>
          ) : null}
        </div>
      </div>
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CLASS} w-full max-w-sm p-4`}>
            <h3 className="mb-3 text-sm font-semibold text-[#34495E]">{t("openShift")}</h3>
            <label className="mb-2 block text-xs text-[#7F8C8D]">
              {t("outletCode")}
              <input
                className={`${MODAL_INPUT_CLASS} ${INPUT_CLASS} mt-1 w-full`}
                value={outletCode}
                onChange={(e) => setOutletCode(e.target.value)}
              />
            </label>
            <label className="mb-3 block text-xs text-[#7F8C8D]">
              {t("openingCash")}
              <input
                className={`${MODAL_INPUT_CLASS} ${INPUT_CLASS} mt-1 w-full`}
                type="number"
                min={0}
                step={0.01}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </label>
            {kkms.length > 0 && (
              <label className="mb-2 block text-xs text-[#7F8C8D]">
                {t("fiscalDevice", { defaultValue: "Cash register (KKM)" })}
                <select
                  className={`${MODAL_INPUT_CLASS} ${INPUT_CLASS} mt-1 w-full`}
                  value={fiscalDeviceId}
                  onChange={(e) => setFiscalDeviceId(e.target.value)}
                >
                  <option value="">{t("autoDefault", { defaultValue: "Default / auto" })}</option>
                  {kkms.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} ({d.providerId})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {banks.length > 0 && (
              <label className="mb-3 block text-xs text-[#7F8C8D]">
                {t("bankTerminal", { defaultValue: "Bank POS" })}
                <select
                  className={`${MODAL_INPUT_CLASS} ${INPUT_CLASS} mt-1 w-full`}
                  value={bankTerminalId}
                  onChange={(e) => setBankTerminalId(e.target.value)}
                >
                  <option value="">{t("autoDefault", { defaultValue: "Default / auto" })}</option>
                  {banks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} ({d.providerId})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() => setOpenModal(false)}
              >
                {tc("cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                disabled={busy}
                onClick={() => void openShift()}
              >
                {t("confirmOpen")}
              </button>
            </div>
          </div>
        </div>
      )}
      {dropModal && shift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CLASS} w-full max-w-sm p-4`}>
            <h3 className="mb-3 text-sm font-semibold text-[#34495E]">{t("dropTitle")}</h3>
            {shift.drawer ? (
              <p className="mb-2 text-sm text-[#34495E]">
                {t("expected")} {shift.drawer.expected.toFixed(2)} {tc("azn")}
              </p>
            ) : null}
            <label className="mb-2 block text-xs text-[#7F8C8D]">
              {t("dropAmount")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                type="number"
                min={0.01}
                step={0.01}
                value={dropAmount}
                onChange={(e) => setDropAmount(e.target.value)}
              />
            </label>
            {shift?.drawer &&
            Number.isFinite(Number(dropAmount)) &&
            Number(dropAmount) > shift.drawer.expected + 0.001 ? (
              <p className="mb-2 text-sm text-[#C0392B]">
                {t("dropOver", { expected: shift.drawer.expected.toFixed(2) })}
              </p>
            ) : null}
            <label className="mb-3 block text-xs text-[#7F8C8D]">
              {t("dropNote")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                value={dropNote}
                onChange={(e) => setDropNote(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setDropModal(false)}>
                {tc("cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                disabled={busy}
                onClick={() => void saveDrop()}
              >
                {t("drop")}
              </button>
            </div>
          </div>
        </div>
      )}
      {closeModal && shift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CLASS} w-full max-w-sm p-4`}>
            <h3 className="mb-3 text-sm font-semibold text-[#34495E]">{t("zClose")}</h3>
            {shift.drawer ? (
              <p className="mb-2 text-sm text-[#34495E]">
                {t("expected")} {shift.drawer.expected.toFixed(2)} {tc("azn")}
              </p>
            ) : null}
            <label className="mb-3 block text-xs text-[#7F8C8D]">
              {t("countedCash")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
                type="number"
                min={0}
                step={0.01}
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
              />
            </label>
            {shift.drawer && countedCash.trim() !== "" && Number.isFinite(Number(countedCash)) ? (
              <p className="mb-3 text-sm text-[#34495E]">
                {t("variance")} {(Number(countedCash) - shift.drawer.expected).toFixed(2)} {tc("azn")}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setCloseModal(false)}>
                {tc("cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                className="rounded bg-[#E74C3C] px-3 py-1.5 text-sm text-white"
                disabled={
                  busy ||
                  countedCash.trim() === "" ||
                  !Number.isFinite(Number(countedCash)) ||
                  Number(countedCash) < 0
                }
                onClick={() => void closeShift()}
              >
                {t("zClose")}
              </button>
            </div>
          </div>
        </div>
      )}
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CLASS} max-h-[80vh] w-full max-w-3xl overflow-auto p-4`}>
            <h3 className="mb-3 text-sm font-semibold text-[#34495E]">
              {reportKind === "z" ? t("zReport") : t("xReport")}
            </h3>
            {reportDrawer ? (
              <div className="mb-3">
                <CashDrawerBlock drawer={reportDrawer} azn={tc("azn")} labels={drawerLabels} />
              </div>
            ) : null}
            <SaleTable
              rows={report.rows}
              totals={report.totals}
              azn={tc("azn")}
              labels={{
                opened: ts("opened"),
                closed: ts("closed"),
                place: ts("place"),
                method: ts("method"),
                shift: ts("closedBy"),
                sum: ts("sum"),
                empty: ts("empty"),
                cash: ts("cash"),
                card: ts("card"),
                transfer: ts("transfer"),
                other: ts("other"),
                count: ts("count"),
                takeaway: ts("takeaway"),
              }}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                onClick={() => {
                  setReport(null);
                  setReportDrawer(null);
                }}
              >
                {tc("cancel", { defaultValue: "Cancel" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
