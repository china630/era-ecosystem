"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type OrderRow = {
  id: string;
  orderNumber: string;
  buyerCounterpartyId: string;
  status: string;
  amountNet: number | string;
  paymentTermDays: number | null;
  tradeCreditGrantId?: string | null;
};

export default function OrdersPage() {
  const t = useTranslations("orders");
  const tNav = useTranslations("nav");
  const tImp = useTranslations("importOrders");
  const tPick = useTranslations("pickLists");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [grantCodes, setGrantCodes] = useState<Record<string, string>>({});
  const [residual, setResidual] = useState<
    Record<string, { available: number; creditLimit: number; source: string }>
  >({});

  async function loadOrders() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadResidual(order: OrderRow) {
    const onAccount = (order.paymentTermDays ?? 0) > 0;
    if (!onAccount) return;
    const res = await fetch(
      `/api/credit-limit?counterpartyId=${encodeURIComponent(order.buyerCounterpartyId)}`,
    );
    const data = await res.json();
    if (!res.ok) return;
    setResidual((prev) => ({
      ...prev,
      [order.id]: {
        available: Number(data.available ?? data.creditLimit ?? 0),
        creditLimit: Number(data.creditLimit ?? 0),
        source: String(data.source ?? ""),
      },
    }));
  }

  async function confirmOrder(order: OrderRow) {
    setMessage("");
    setBusyId(order.id);
    const onAccount = (order.paymentTermDays ?? 0) > 0;
    const body: { grantCode?: string } = {};
    if (onAccount) {
      const code = (grantCodes[order.id] ?? "").trim();
      if (code) body.grantCode = code;
    }
    const res = await fetch(`/api/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMessage(data.error ?? t("confirmFailed"));
      return;
    }
    setMessage(t("confirmed", { order: order.orderNumber }));
    await loadOrders();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/import-orders" className={SECONDARY_BUTTON_CLASS}>
              {tImp("title")}
            </Link>
            <Link href="/pick-lists" className={SECONDARY_BUTTON_CLASS}>
              {tPick("title")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        {message ? <p className="text-[13px]">{message}</p> : null}
        <p className="text-[13px] text-[#7F8C8D]">{t("shellNote")}</p>
        <ul className="space-y-3">
          {orders.map((order) => {
            const onAccount = (order.paymentTermDays ?? 0) > 0;
            const credit = residual[order.id];
            return (
              <li
                key={order.id}
                className="rounded-lg border border-[#D5DADF] p-3 text-[13px]"
              >
                <div className="font-medium">
                  {order.orderNumber} — {order.status} —{" "}
                  {Number(order.amountNet).toFixed(2)} AZN
                </div>
                <div className="mt-1 text-[#7F8C8D]">
                  {order.buyerCounterpartyId}
                  {onAccount
                    ? ` · ${t("onAccount")} (${order.paymentTermDays}d)`
                    : ` · ${t("prepaid")}`}
                </div>
                {order.status !== "CONFIRMED" && onAccount ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      className="text-[#2980B9] underline"
                      onClick={() => void loadResidual(order)}
                    >
                      {t("showResidual")}
                    </button>
                    {credit ? (
                      <p>
                        {t("available")}: {credit.available.toFixed(2)} AZN /{" "}
                        {t("limit")}: {credit.creditLimit.toFixed(2)} ({credit.source})
                      </p>
                    ) : null}
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t("grantCode")}</label>
                      <input
                        className={MODAL_INPUT_CLASS}
                        value={grantCodes[order.id] ?? ""}
                        onChange={(e) =>
                          setGrantCodes((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        placeholder={t("grantCodePlaceholder")}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : null}
                {order.status !== "CONFIRMED" ? (
                  <button
                    type="button"
                    className={`${PRIMARY_BUTTON_CLASS} mt-3`}
                    disabled={busyId === order.id}
                    onClick={() => void confirmOrder(order)}
                  >
                    {t("confirm")}
                  </button>
                ) : order.tradeCreditGrantId ? (
                  <p className="mt-2 font-mono text-[11px] text-[#7F8C8D]">
                    grant: {order.tradeCreditGrantId}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
