"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";
import type { RetailPreset, RetailPresetConfig } from "@/lib/retail-preset";

type Shift = { id: string; status: string };
type ReceiptLine = {
  id: string;
  description: string;
  qty: number;
  unitPrice: string | number;
  lineTotal: string | number;
  lineStatus: string;
  plu?: string | null;
  barcode?: string | null;
  isWeighted?: boolean;
  weightKg?: string | number | null;
  size?: string | null;
  color?: string | null;
  serial?: string | null;
  batch?: string | null;
  rxRequired?: boolean;
  rxApprovedBy?: string | null;
};
type Receipt = {
  id: string;
  amountNet: string | number;
  status: string;
  lines?: ReceiptLine[];
};

type LineForm = {
  description: string;
  qty: string;
  unitPrice: string;
  plu: string;
  barcode: string;
  isWeighted: boolean;
  weightKg: string;
  size: string;
  color: string;
  serial: string;
  batch: string;
  rxRequired: boolean;
  rxApprovedBy: string;
};

const EMPTY_LINE: LineForm = {
  description: "Sample item",
  qty: "1",
  unitPrice: "10",
  plu: "",
  barcode: "",
  isWeighted: false,
  weightKg: "",
  size: "",
  color: "",
  serial: "",
  batch: "",
  rxRequired: false,
  rxApprovedBy: "",
};

export default function PosCheckoutPage() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [preset, setPreset] = useState<RetailPreset>("grocery");
  const [presetConfig, setPresetConfig] = useState<
    Record<RetailPreset, RetailPresetConfig> | null
  >(null);
  const [lineForm, setLineForm] = useState<LineForm>(EMPTY_LINE);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [zSummary, setZSummary] = useState<{
    totalSales: number;
    receiptCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/presets")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setPresetConfig(data.config);
      })
      .catch(() => setMessage("Failed to load preset config"));
  }, []);

  const activeLineFields = useMemo(() => {
    if (!presetConfig) return [];
    return presetConfig[preset]?.lineFields ?? [];
  }, [preset, presetConfig]);

  function updateLineForm<K extends keyof LineForm>(key: K, value: LineForm[K]) {
    setLineForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildLinePayload() {
    const payload: Record<string, unknown> = {
      description: lineForm.description,
      qty: Number(lineForm.qty) || 1,
      unitPrice: Number(lineForm.unitPrice) || 0,
    };
    if (activeLineFields.includes("plu") || activeLineFields.includes("sku")) {
      payload.plu = lineForm.plu;
    }
    if (activeLineFields.includes("barcode")) payload.barcode = lineForm.barcode;
    if (activeLineFields.includes("isWeighted")) {
      payload.isWeighted = lineForm.isWeighted;
      if (lineForm.isWeighted && lineForm.weightKg) {
        payload.weightKg = Number(lineForm.weightKg);
      }
    }
    if (activeLineFields.includes("size")) payload.size = lineForm.size;
    if (activeLineFields.includes("color")) payload.color = lineForm.color;
    if (activeLineFields.includes("serial")) payload.serial = lineForm.serial;
    if (activeLineFields.includes("batch")) payload.batch = lineForm.batch;
    if (activeLineFields.includes("rxRequired")) {
      payload.rxRequired = lineForm.rxRequired;
      if (lineForm.rxRequired) payload.rxApprovedBy = lineForm.rxApprovedBy;
    }
    return payload;
  }

  async function openShift() {
    setLoading(true);
    setMessage("");
    setZSummary(null);
    try {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletCode: "MAIN",
          registerCode: "R1",
          preset,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open shift");
      setShift(data);
      setReceipt(null);
      setMessage(`Shift open (${preset}): ${data.id.slice(0, 8)}`);
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
          lines: [buildLinePayload()],
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

  async function voidLine(lineId: string) {
    if (!receipt) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/receipts/${receipt.id}/lines/${lineId}/void`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Void line failed");
      setReceipt(data);
      setMessage(`Line voided — new total ${Number(data.amountNet).toFixed(2)} AZN`);
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

  async function returnReceipt() {
    if (!receipt) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/receipts/${receipt.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "customer return" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Return failed");
      setReceipt(data.returnReceipt);
      setMessage(
        `Return processed (${Number(data.returnReceipt.amountNet).toFixed(2)} AZN) — sale event dispatched`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Close shift failed");
      setShift(data);
      setZSummary({
        totalSales: Number(data.totalSales ?? 0),
        receiptCount: Number(data.receiptCount ?? 0),
      });
      setMessage("Shift closed — SATELLITE_RETAIL_SHIFT_CLOSED dispatched");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const activeLines =
    receipt?.lines?.filter((line) => line.lineStatus === "ACTIVE") ?? [];

  return (
    <>
      <PageHeader
        title="ERA Retail POS"
        subtitle="Preset checkout — shift, lines, pay, return, Z-close"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            Outlet preset
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={preset}
              disabled={loading || !!shift}
              onChange={(e) => setPreset(e.target.value as RetailPreset)}
            >
              {(presetConfig
                ? (Object.keys(presetConfig) as RetailPreset[])
                : (["grocery", "apparel", "electronics", "pharmacy"] as RetailPreset[])
              ).map((code) => (
                <option key={code} value={code}>
                  {presetConfig?.[code]?.label ?? code}
                </option>
              ))}
            </select>
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !!shift}
            onClick={openShift}
          >
            Open shift
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !shift || shift.status === "CLOSED"}
            onClick={createReceipt}
          >
            Add receipt
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={
              loading ||
              !receipt ||
              receipt.status === "PAID" ||
              activeLines.length === 0
            }
            onClick={payReceipt}
          >
            Pay
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !receipt || receipt.status !== "PAID"}
            onClick={returnReceipt}
          >
            Return
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !shift || shift.status === "CLOSED"}
            onClick={closeShift}
          >
            Close shift
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            Line description
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={lineForm.description}
              onChange={(e) => updateLineForm("description", e.target.value)}
            />
          </label>
          <label className="text-[13px]">
            Unit price (AZN)
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={lineForm.unitPrice}
              onChange={(e) => updateLineForm("unitPrice", e.target.value)}
            />
          </label>
          {activeLineFields.includes("qty") && (
            <label className="text-[13px]">
              Qty
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.qty}
                onChange={(e) => updateLineForm("qty", e.target.value)}
              />
            </label>
          )}
          {(activeLineFields.includes("plu") ||
            activeLineFields.includes("sku")) && (
            <label className="text-[13px]">
              PLU / SKU
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.plu}
                onChange={(e) => updateLineForm("plu", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("barcode") && (
            <label className="text-[13px]">
              Barcode
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.barcode}
                onChange={(e) => updateLineForm("barcode", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("size") && (
            <label className="text-[13px]">
              Size
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.size}
                onChange={(e) => updateLineForm("size", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("color") && (
            <label className="text-[13px]">
              Color
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.color}
                onChange={(e) => updateLineForm("color", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("serial") && (
            <label className="text-[13px]">
              Serial
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.serial}
                onChange={(e) => updateLineForm("serial", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("batch") && (
            <label className="text-[13px]">
              Batch
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.batch}
                onChange={(e) => updateLineForm("batch", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("isWeighted") && (
            <label className="flex items-center gap-2 text-[13px] pt-5">
              <input
                type="checkbox"
                checked={lineForm.isWeighted}
                onChange={(e) => updateLineForm("isWeighted", e.target.checked)}
              />
              Weighted item
            </label>
          )}
          {lineForm.isWeighted && activeLineFields.includes("isWeighted") && (
            <label className="text-[13px]">
              Weight (kg)
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.weightKg}
                onChange={(e) => updateLineForm("weightKg", e.target.value)}
              />
            </label>
          )}
          {activeLineFields.includes("rxRequired") && (
            <label className="flex items-center gap-2 text-[13px] pt-5">
              <input
                type="checkbox"
                checked={lineForm.rxRequired}
                onChange={(e) => updateLineForm("rxRequired", e.target.checked)}
              />
              Rx required
            </label>
          )}
          {lineForm.rxRequired && activeLineFields.includes("rxRequired") && (
            <label className="text-[13px]">
              Rx approved by
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lineForm.rxApprovedBy}
                onChange={(e) => updateLineForm("rxApprovedBy", e.target.value)}
              />
            </label>
          )}
        </div>

        {receipt?.lines && receipt.lines.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Receipt lines</p>
            <ul className="space-y-1 text-[13px]">
              {receipt.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                >
                  <span>
                    {line.description} — {Number(line.lineTotal).toFixed(2)} AZN
                    {line.lineStatus === "VOID" ? " (VOID)" : ""}
                  </span>
                  {receipt.status === "OPEN" && line.lineStatus === "ACTIVE" && (
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5 text-[12px]"
                      disabled={loading}
                      onClick={() => voidLine(line.id)}
                    >
                      Void line
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {shift && (
          <p className="text-[13px] text-[#7F8C8D]">
            Shift: {shift.id.slice(0, 8)} ({shift.status}) · Preset: {preset}
          </p>
        )}
        {receipt && (
          <p className="text-[13px] text-[#7F8C8D]">
            Receipt: {receipt.id.slice(0, 8)} —{" "}
            {Number(receipt.amountNet).toFixed(2)} AZN ({receipt.status})
          </p>
        )}
        {zSummary && (
          <p className="text-[13px] text-[#7F8C8D]">
            Z-summary: {zSummary.receiptCount} receipts,{" "}
            {zSummary.totalSales.toFixed(2)} AZN total sales
          </p>
        )}
        {message && <p className="text-[13px]">{message}</p>}
      </div>
    </>
  );
}
