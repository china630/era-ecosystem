"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";

type OpenShift = {
  id: string;
  status: string;
  openingCash: string | number;
  openedAt: string;
  outlet: { code: string; name: string };
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

  useEffect(() => {
    void load();
  }, [load]);

  async function openShift() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletCode: outletCode.trim() || "RESTAURANT",
        openingCash: Number(openingCash) || 0,
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
