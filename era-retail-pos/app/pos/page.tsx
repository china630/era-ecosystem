"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Shift = { id: string; status: string };
type Receipt = { id: string; amountNet: string | number; status: string };

export default function PosCheckoutPage() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [description, setDescription] = useState("Sample item");
  const [unitPrice, setUnitPrice] = useState("10");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function openShift() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletCode: "MAIN", registerCode: "R1", preset: "grocery" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open shift");
      setShift(data);
      setReceipt(null);
      setMessage(`Shift open: ${data.id.slice(0, 8)}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function createReceipt() {
    if (!shift) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          lines: [{ description, qty: 1, unitPrice: Number(unitPrice) }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create receipt");
      setReceipt(data);
      setMessage(`Receipt created: ${Number(data.amountNet).toFixed(2)} AZN`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function payReceipt() {
    if (!receipt) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/receipts/${receipt.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      setReceipt(data);
      setMessage("Paid — SATELLITE_RETAIL_SALE_COMPLETED dispatched");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="ERA Retail POS"
        subtitle="MVP checkout — open shift, add line, pay"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading}
            onClick={openShift}
          >
            Open shift
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !shift}
            onClick={createReceipt}
          >
            Add receipt
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !receipt || receipt.status === "PAID"}
            onClick={payReceipt}
          >
            Pay
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            Line description
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="text-[13px]">
            Unit price (AZN)
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
          <label className="text-[13px]">
            Payment method
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </label>
        </div>

        {shift && (
          <p className="text-[13px] text-[#7F8C8D]">
            Shift: {shift.id.slice(0, 8)} ({shift.status})
          </p>
        )}
        {receipt && (
          <p className="text-[13px] text-[#7F8C8D]">
            Receipt: {receipt.id.slice(0, 8)} — {Number(receipt.amountNet).toFixed(2)} AZN ({receipt.status})
          </p>
        )}
        {message && <p className="text-[13px]">{message}</p>}
      </div>
    </>
  );
}
