"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";

type TicketLine = {
  id: string;
  description: string;
  qty: number;
  unitPriceAzn: string | number;
  kitchenStatus: string;
};

type Ticket = {
  id: string;
  status: string;
  totalAzn: string | number;
  discountPercent?: string | number;
  table?: { code: string } | null;
  outlet: { code: string };
  lines: TicketLine[];
};

export default function OrdersPanel() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [discountInput, setDiscountInput] = useState("0");
  const [splitLineIds, setSplitLineIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tickets");
    const data = await res.json();
    setTickets(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;

  useEffect(() => {
    if (selected) {
      setDiscountInput(String(Number(selected.discountPercent ?? 0)));
      setSplitLineIds([]);
    }
  }, [selected?.id, selected?.discountPercent]);

  async function fireTicket() {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/fire`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Fire failed");
      return;
    }
    setMessage(`Fired ${data.firedCount} line(s) to kitchen`);
    await load();
  }

  async function payCash() {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "CASH" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Payment failed");
      return;
    }
    setMessage(`Paid ${Number(data.amount).toFixed(2)} ${tc("azn")} (stub fiscal)`);
    setSelectedId(null);
    await load();
  }

  async function voidLine(lineId: string) {
    if (!selected) return;
    setMessage("");
    const res = await fetch(
      `/api/tickets/${selected.id}/lines/${lineId}/void`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manager void" }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Void failed (manager role required)");
      return;
    }
    setMessage("Line voided");
    await load();
  }

  async function applyDiscount() {
    if (!selected) return;
    setMessage("");
    const discountPercent = parseFloat(discountInput);
    if (Number.isNaN(discountPercent)) return;
    const res = await fetch(`/api/tickets/${selected.id}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPercent }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Discount failed (manager role required)");
      return;
    }
    setMessage(`Discount ${discountPercent}% applied`);
    await load();
  }

  async function splitTicket() {
    if (!selected || splitLineIds.length === 0) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineIds: splitLineIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Split failed");
      return;
    }
    setMessage(`Split ticket ${data.split?.id?.slice(0, 8) ?? ""} created`);
    setSplitLineIds([]);
    await load();
  }

  function toggleSplitLine(lineId: string) {
    setSplitLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId],
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("openTickets")}</h2>
        {loading ? (
          <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : tickets.length === 0 ? (
          <p className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("noTickets")}</p>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelectedId(ticket.id)}
              className={`${CARD_CLASS} w-full p-4 text-left ${
                selected?.id === ticket.id ? "border-[#2980B9]" : ""
              }`}
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {ticket.table?.code ?? "Walk-in"} · {ticket.outlet.code}
                </span>
                <span>{ticket.status}</span>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {Number(ticket.totalAzn).toFixed(2)} {tc("azn")}
              </p>
            </button>
          ))
        )}
      </div>

      <div className={`${CARD_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t("ticketActions")}</h2>
        {!selected ? (
          <p className="text-sm text-[#7F8C8D]">{t("selectTicket")}</p>
        ) : (
          <>
            <ul className="mb-4 space-y-1 text-xs text-[#7F8C8D]">
              {selected.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <label className="flex flex-1 items-center gap-2">
                    {l.kitchenStatus !== "VOID" && (
                      <input
                        type="checkbox"
                        checked={splitLineIds.includes(l.id)}
                        onChange={() => toggleSplitLine(l.id)}
                        aria-label={t("selectLinesToSplit")}
                      />
                    )}
                    <span>
                      {l.qty}× {l.description} ({l.kitchenStatus})
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-red-600 underline"
                    onClick={() => void voidLine(l.id)}
                  >
                    {t("void")}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-xs text-[#7F8C8D]">
                {t("applyDiscount")}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className={`${INPUT_CLASS} mt-1 w-20`}
                />
              </label>
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
                onClick={() => void applyDiscount()}
              >
                {t("applyDiscount")}
              </button>
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
                disabled={splitLineIds.length === 0}
                onClick={() => void splitTicket()}
              >
                {t("splitSelected")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                onClick={() => void fireTicket()}
              >
                {t("fireKitchen")}
              </button>
              <button
                type="button"
                className="rounded bg-[#27AE60] px-3 py-1.5 text-sm text-white"
                onClick={() => void payCash()}
              >
                {t("payCash")}
              </button>
              <Link
                href="/kds"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
              >
                {t("openKds")}
              </Link>
            </div>
          </>
        )}
        {message && <p className="mt-3 text-sm">{message}</p>}
        <p className="mt-3 text-xs text-[#7F8C8D]">{t("roleHint")}</p>
      </div>
    </div>
  );
}
