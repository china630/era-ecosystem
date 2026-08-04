"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  clinicTenderOptions,
  Field,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TR_CLASS,
} from "@era/satellite-kit/ui";

export type BillLine = {
  serviceCode: string;
  description: string;
  amount: number;
  sourceType: string;
  sourceId: string | null;
};

export type UnifiedBill = {
  visitId: string;
  patientRef: { id: string; refCode: string; fullName: string };
  patientOrigin: string;
  channel: string;
  lines: BillLine[];
  amountGross: number;
  discountAmount: number;
  amountNet: number;
  alreadyPaid: boolean;
  reservationId: string | null;
  roomNumber: string | null;
};

type PaymentRow = { method: string; amount: string };

type Props = {
  visitId: string | null;
  shiftId: string | null;
  onClose: () => void;
  onSettled: () => void;
};

export function CashierSettleModal({ visitId, shiftId, onClose, onSettled }: Props) {
  const t = useTranslations("cashier");
  const locale = useLocale();
  const [bill, setBill] = useState<UnifiedBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraDiscount, setExtraDiscount] = useState("0");
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: "" }]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visitId) {
      setBill(null);
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    void fetch(`/api/cashier/bills/${visitId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? t("loadBillFailed"));
        const b = (d.data ?? d) as UnifiedBill;
        setBill(b);
        setPayments([{ method: "CASH", amount: String(b.amountNet) }]);
        setExtraDiscount("0");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visitId, t]);

  if (!visitId) return null;

  const channel = bill?.channel ?? "LOCAL";
  const netAfterExtra = bill
    ? Math.max(
        0,
        Math.round((bill.amountNet - (Number(extraDiscount) || 0)) * 100) / 100,
      )
    : 0;

  async function settle(forceLocal = false) {
    if (!visitId) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        shiftId: shiftId ?? undefined,
        extraDiscount: Number(extraDiscount) || 0,
        forceLocal,
      };
      if (channel === "LOCAL" || forceLocal) {
        body.payments = payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount) || 0,
        }));
      }
      const res = await fetch(`/api/cashier/bills/${visitId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("paymentFailed"));
      setResult(data.data ?? data);
      onSettled();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("paymentFailed"));
    } finally {
      setBusy(false);
    }
  }

  const actionLabel =
    channel === "HOTEL_FOLIO"
      ? t("actionFolio")
      : channel === "SETTLEMENT_HUB"
        ? t("actionHub")
        : t("actionLocal");

  return (
    <ModalShell
      open={!!visitId}
      onClose={onClose}
      title={t("settleTitle")}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
            {t("close")}
          </button>
          {!result && bill && !bill.alreadyPaid && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || loading}
              onClick={() => void settle(false)}
            >
              {busy ? t("busy") : actionLabel}
            </button>
          )}
        </div>
      }
    >
      {loading && <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("loading")}</p>}
      {error && <p className={`text-sm ${TEXT_DANGER_CLASS}`}>{error}</p>}
      {bill && !result && (
        <div className="space-y-4">
          <div className="text-sm">
            <p>
              <span className={TEXT_MUTED_CLASS}>{t("patient")}: </span>
              {bill.patientRef.fullName} ({bill.patientRef.refCode})
            </p>
            <p>
              <span className={TEXT_MUTED_CLASS}>{t("channelLabel")}: </span>
              {t(`channel.${bill.channel}` as "channel.LOCAL")}
            </p>
            {bill.roomNumber && (
              <p>
                <span className={TEXT_MUTED_CLASS}>{t("room")}: </span>
                {bill.roomNumber}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSource")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDesc")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((l, i) => (
                  <tr key={`${l.sourceId ?? l.serviceCode}-${i}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{l.sourceType}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{l.serviceCode}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{l.description}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{l.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <p>
              {t("gross")}: <strong>{bill.amountGross.toFixed(2)}</strong>
            </p>
            <p>
              {t("discount")}: <strong>{bill.discountAmount.toFixed(2)}</strong>
            </p>
            <p>
              {t("net")}: <strong>{netAfterExtra.toFixed(2)} AZN</strong>
            </p>
          </div>

          {(channel === "LOCAL" || channel === "FINANCE") && (
            <>
              <Field
                label={t("extraDiscount")}
                preset="amount"
                type="number"
                value={extraDiscount}
                onChange={(e) => {
                  setExtraDiscount(e.target.value);
                  const next = Math.max(
                    0,
                    (bill.amountNet - (Number(e.target.value) || 0)),
                  );
                  setPayments((prev) =>
                    prev.length === 1
                      ? [{ ...prev[0], amount: String(Math.round(next * 100) / 100) }]
                      : prev,
                  );
                }}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("payments")}</p>
                {payments.map((p, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-end">
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t("payMethod")}
                      value={p.method}
                      onChange={(v) => {
                        const next = [...payments];
                        next[idx] = { ...next[idx], method: String(v) };
                        setPayments(next);
                      }}
                      options={clinicTenderOptions(
                        locale.startsWith("az") ? "az" : locale.startsWith("ru") ? "ru" : "en",
                      )}
                    />
                    <Field
                      label={t("payAmount")}
                      preset="amount"
                      type="number"
                      value={p.amount}
                      onChange={(e) => {
                        const next = [...payments];
                        next[idx] = { ...next[idx], amount: e.target.value };
                        setPayments(next);
                      }}
                    />
                    {payments.length > 1 && (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                      >
                        {t("removePayment")}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => setPayments([...payments, { method: "CARD", amount: "0" }])}
                >
                  {t("addPayment")}
                </button>
              </div>
            </>
          )}

          <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            {t("mockFiscalBadge")}
          </span>
        </div>
      )}

      {result && (
        <div className="rounded border bg-emerald-50 p-3 text-sm space-y-1">
          <p>{t("settledOk")}</p>
          <p className={TEXT_MUTED_CLASS}>
            {t("channelLabel")}: {String((result as { channel?: string }).channel ?? channel)}
          </p>
        </div>
      )}
    </ModalShell>
  );
}
