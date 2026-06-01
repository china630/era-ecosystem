"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type PickLine = {
  id: string;
  skuCode: string;
  qtyOrdered: number;
  qtyPicked: number;
};

type PickList = {
  id: string;
  status: string;
  order: { orderNumber: string; buyerCounterpartyId: string };
  lines: PickLine[];
};

type Order = {
  orderNumber: string;
  buyerCounterpartyId: string;
};

const pickFormId = "create-pick-list-form";
const creditFormId = "credit-check-form";

export default function PickListsPage() {
  const t = useTranslations("pickLists");
  const tc = useTranslations("common");
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [creditSource, setCreditSource] = useState("");
  const [message, setMessage] = useState("");
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadPickLists() {
    const res = await fetch("/api/pick-lists");
    const data = await res.json();
    setPickLists(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void loadPickLists();
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => setOrders([]));
  }, []);

  async function createPickList(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/pick-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber,
        lines: [{ skuCode, qtyOrdered: Number(qtyOrdered) }],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("createFailed"));
      return;
    }
    setMessage(t("pickCreated", { order: data.order?.orderNumber ?? orderNumber }));
    setPickModalOpen(false);
    await loadPickLists();
  }

  async function confirmPick(pickListId: string, line: PickLine) {
    setMessage("");
    const res = await fetch(
      `/api/pick-lists/${pickListId}/lines/${line.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyPicked: line.qtyOrdered }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("pickConfirmFailed"));
      return;
    }
    setMessage(t("picked", { sku: line.skuCode }));
    await loadPickLists();
  }

  async function checkCredit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch(
      `/api/credit-limit?counterpartyId=${encodeURIComponent(counterpartyId)}`,
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("creditFailed"));
      return;
    }
    setCreditLimit(data.creditLimit);
    setCreditSource(data.source);
    setCreditModalOpen(false);
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setPickModalOpen(true)}>
              {t("createPickList")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreditModalOpen(true)}>
              {t("checkCredit")}
            </button>
            <Link href="/orders" className={PRIMARY_BUTTON_CLASS}>
              {t("orders")}
            </Link>
          </>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {message && <p className="text-[13px]">{message}</p>}
        {creditLimit != null && (
          <p className="text-[13px]">
            {t("limit")}: {creditLimit} AZN ({creditSource})
          </p>
        )}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold">{t("openPickLists")}</h2>
          <ul className="space-y-3 text-[13px]">
            {pickLists.map((pl) => (
              <li key={pl.id} className="rounded border p-3">
                <div className="font-medium">
                  {pl.order.orderNumber} — {pl.status}
                </div>
                <ul className="mt-2 space-y-1">
                  {pl.lines.map((line) => (
                    <li key={line.id} className="flex items-center justify-between">
                      <span>
                        {line.skuCode}: {line.qtyPicked}/{line.qtyOrdered}
                      </span>
                      {line.qtyPicked < line.qtyOrdered && (
                        <button
                          type="button"
                          className="text-[#2980B9] underline"
                          onClick={() => void confirmPick(pl.id, line)}
                        >
                          {t("confirmPick")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ModalShell
        open={pickModalOpen}
        title={t("createPickList")}
        onClose={() => setPickModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={pickFormId}
            onCancel={() => setPickModalOpen(false)}
            busy={busy}
            submitLabel={t("createPickList")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={pickFormId} onSubmit={createPickList} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("selectOrder")}</label>
            <select
              className={MODAL_INPUT_CLASS}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
            >
              <option value="">{t("selectOrder")}</option>
              {orders.map((o) => (
                <option key={o.orderNumber} value={o.orderNumber}>
                  {o.orderNumber} ({o.buyerCounterpartyId})
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("sku")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("qtyOrdered")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={qtyOrdered}
              onChange={(e) => setQtyOrdered(e.target.value)}
              required
            />
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={creditModalOpen}
        title={t("creditCheck")}
        onClose={() => setCreditModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={creditFormId}
            onCancel={() => setCreditModalOpen(false)}
            busy={busy}
            submitLabel={t("checkCredit")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={creditFormId} onSubmit={checkCredit} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("counterpartyId")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              required
            />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
