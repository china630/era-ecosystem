"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";

type OpenShift = {
  id: string;
  status: string;
  openingCash: string | number;
  openedAt: string;
  fiscalDeviceId?: string | null;
  bankTerminalId?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [outletCode, setOutletCode] = useState("RESTAURANT");
  const [openingCash, setOpeningCash] = useState("0");
  const [kkms, setKkms] = useState<FiscalDevice[]>([]);
  const [banks, setBanks] = useState<FiscalDevice[]>([]);
  const [fiscalDeviceId, setFiscalDeviceId] = useState("");
  const [bankTerminalId, setBankTerminalId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shifts/open");
    const data = await res.json();
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
    if (openModal) void loadDevices(outletCode.trim() || "RESTAURANT");
  }, [openModal, outletCode, loadDevices]);

  async function openShift() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletCode: outletCode.trim() || "RESTAURANT",
        openingCash: Number(openingCash) || 0,
        ...(fiscalDeviceId ? { fiscalDeviceId } : {}),
        ...(bankTerminalId ? { bankTerminalId } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("openFailed"));
      return;
    }
    setOpenModal(false);
    setMessage(t("opened"));
    await load();
  }

  async function closeShift() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift?.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (res.status === 403) {
        setMessage(t("managerRequired"));
      } else if (res.status === 409) {
        setMessage(t("openTicketsBlock", { count: data.openTickets ?? "?" }));
      } else {
        setMessage(data.error ?? t("closeFailed"));
      }
      return;
    }
    setMessage(t("closed"));
    await load();
  }

  return (
    <div className={`${CARD_CLASS} mb-4 p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
            {t("title")}
          </p>
          {loading ? (
            <p className="text-sm text-[#7F8C8D]">{tc("loading", { defaultValue: "Loading…" })}</p>
          ) : shift ? (
            <p className="text-sm text-[#34495E]">
              {t("openStatus", {
                outlet: shift.outlet.code,
                cash: Number(shift.openingCash).toFixed(2),
                time: new Date(shift.openedAt).toLocaleTimeString(),
              })}
              {shift.fiscalDeviceId
                ? ` · KKM ${shift.fiscalDeviceId.slice(0, 8)}`
                : ""}
            </p>
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
          {shift && (
            <button
              type="button"
              className="rounded border border-[#E74C3C] px-3 py-1.5 text-sm text-[#E74C3C]"
              disabled={busy}
              onClick={() => void closeShift()}
            >
              {t("zClose")}
            </button>
          )}
        </div>
      </div>
      {message && <p className="mt-2 text-xs text-[#34495E]">{message}</p>}

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CLASS} w-full max-w-sm p-4`}>
            <h3 className="mb-3 text-sm font-semibold text-[#34495E]">{t("openShift")}</h3>
            <label className="mb-2 block text-xs text-[#7F8C8D]">
              {t("outletCode")}
              <input
                className={`${INPUT_CLASS} mt-1 w-full`}
                value={outletCode}
                onChange={(e) => setOutletCode(e.target.value)}
              />
            </label>
            <label className="mb-3 block text-xs text-[#7F8C8D]">
              {t("openingCash")}
              <input
                type="number"
                min={0}
                step={0.01}
                className={`${INPUT_CLASS} mt-1 w-full`}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </label>
            {kkms.length > 0 && (
              <label className="mb-2 block text-xs text-[#7F8C8D]">
                {t("fiscalDevice", { defaultValue: "Cash register (KKM)" })}
                <select
                  className={`${INPUT_CLASS} mt-1 w-full`}
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
                  className={`${INPUT_CLASS} mt-1 w-full`}
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
    </div>
  );
}
