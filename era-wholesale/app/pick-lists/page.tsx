"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

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

export default function PickListsPage() {
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [creditSource, setCreditSource] = useState("");
  const [message, setMessage] = useState("");

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
    if (!res.ok) {
      setMessage(data.error ?? "Create failed");
      return;
    }
    setMessage(`Pick list for ${data.order?.orderNumber ?? orderNumber}`);
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
      setMessage(data.error ?? "Pick confirm failed");
      return;
    }
    setMessage(`Picked ${line.skuCode}`);
    await loadPickLists();
  }

  async function checkCredit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch(
      `/api/credit-limit?counterpartyId=${encodeURIComponent(counterpartyId)}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Credit check failed");
      return;
    }
    setCreditLimit(data.creditLimit);
    setCreditSource(data.source);
  }

  return (
    <>
      <PageHeader
        title="Pick lists"
        subtitle="W2 — warehouse pick confirm + credit limit"
        actions={
          <Link href="/orders" className={PRIMARY_BUTTON_CLASS}>
            Orders
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        <form onSubmit={createPickList} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold">Create pick list</h2>
          <select
            className="block w-full rounded border px-2 py-1 text-[13px]"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          >
            <option value="">Select order…</option>
            {orders.map((o) => (
              <option key={o.orderNumber} value={o.orderNumber}>
                {o.orderNumber} ({o.buyerCounterpartyId})
              </option>
            ))}
          </select>
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="SKU"
            value={skuCode}
            onChange={(e) => setSkuCode(e.target.value)}
          />
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Qty ordered"
            value={qtyOrdered}
            onChange={(e) => setQtyOrdered(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Create pick list
          </button>
        </form>

        <form onSubmit={checkCredit} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold">Credit limit check</h2>
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Counterparty ID"
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Check credit
          </button>
          {creditLimit != null && (
            <p className="text-[13px]">
              Limit: {creditLimit} AZN ({creditSource})
            </p>
          )}
        </form>

        {message && <p className="text-[13px]">{message}</p>}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Open pick lists</h2>
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
                          Confirm pick
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
    </>
  );
}
