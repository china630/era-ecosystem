"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";

type PayResult = {
  receipt?: {
    id: string;
    status: string;
    amountNet: string | number;
    fiscalReceiptId?: string | null;
    fiscalQrPayload?: string | null;
  };
  fiscal?: {
    receiptId?: string;
    qrPayload?: string;
  };
  settlementOnly?: boolean;
  status?: string;
  receiptId?: string;
  fiscalNumber?: string;
  amount?: number;
};

export default function CashierPage() {
  const t = useTranslations("cashier");
  const params = useSearchParams();
  const visitId = params.get("visitId") ?? "";
  const [shiftId, setShiftId] = useState("");
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hubActive, setHubActive] = useState(false);

  useEffect(() => {
    void fetch("/api/billing/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setHubActive(Boolean(data.deferWalkInToHub));
      })
      .catch(() => setHubActive(false));
  }, []);

  async function openShift() {
    const res = await fetch("/api/cashier/shifts/open", { method: "POST" });
    const d = await res.json();
    setShiftId(d.data?.id ?? d.id ?? "");
  }

  async function pay() {
    if (!visitId || !shiftId) return;
    setError(null);
    const res = await fetch(`/api/cashier/receipts/${visitId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, paymentMethod: "CASH" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("paymentFailed"));
      return;
    }
    setResult((data.data ?? data) as PayResult);
  }

  const receipt = result?.receipt;
  const fiscalId = result?.fiscal?.receiptId ?? receipt?.fiscalReceiptId ?? result?.fiscalNumber;
  const qrPayload = result?.fiscal?.qrPayload ?? receipt?.fiscalQrPayload;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        {hubActive && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t("hubBanner")}
          </div>
        )}
        <p className="text-sm">{t("visitLabel")}: {visitId || "—"}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openShift()}>
          {t("openShift")}
        </button>
        <p className="text-xs">{t("shiftLabel")}: {shiftId || "—"}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void pay()} disabled={hubActive}>
          {t("pay")}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="rounded border bg-emerald-50 p-3 text-sm space-y-1">
            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              {t("mockFiscalBadge")}
            </span>
            <p>{t("statusLabel")}: {receipt?.status ?? result.status ?? "PAID"}</p>
            {(receipt?.id ?? result.receiptId) && (
              <p>{t("receiptLabel")}: {receipt?.id ?? result.receiptId}</p>
            )}
            {fiscalId && <p>{t("fiscalLabel")}: {fiscalId}</p>}
            {qrPayload && (
              <p className="break-all text-xs">
                {t("qrLabel")}: {qrPayload}
              </p>
            )}
            {result.settlementOnly ? (
              <p className="text-xs text-[#7F8C8D]">{t("settlementOnly")}</p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
