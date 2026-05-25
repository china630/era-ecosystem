"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CARD_CLASS } from "@/lib/design-system";

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
  table?: { code: string } | null;
  outlet: { code: string };
  lines: TicketLine[];
};

export default function OrdersPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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

  const selected = tickets.find((t) => t.id === selectedId) ?? tickets[0] ?? null;

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
    setMessage(`Paid ${Number(data.amount).toFixed(2)} AZN (stub fiscal)`);
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#34495E]">Open tickets</h2>
        {loading ? (
          <p className="text-sm text-[#7F8C8D]">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>No open tickets.</p>
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
                {Number(ticket.totalAzn).toFixed(2)} AZN
              </p>
            </button>
          ))
        )}
      </div>

      <div className={`${CARD_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">Ticket actions</h2>
        {!selected ? (
          <p className="text-sm text-[#7F8C8D]">Select a ticket</p>
        ) : (
          <>
            <ul className="mb-4 space-y-1 text-xs text-[#7F8C8D]">
              {selected.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>
                    {l.qty}× {l.description} ({l.kitchenStatus})
                  </span>
                  <button
                    type="button"
                    className="text-red-600 underline"
                    onClick={() => void voidLine(l.id)}
                  >
                    Void
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                onClick={() => void fireTicket()}
              >
                Fire kitchen
              </button>
              <button
                type="button"
                className="rounded bg-[#27AE60] px-3 py-1.5 text-sm text-white"
                onClick={() => void payCash()}
              >
                Pay cash
              </button>
              <Link
                href="/kds"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
              >
                Open KDS
              </Link>
            </div>
          </>
        )}
        {message && <p className="mt-3 text-sm">{message}</p>}
        <p className="mt-3 text-xs text-[#7F8C8D]">
          Sign in as waiter for fire/pay; manager for void and Z-close.
        </p>
      </div>
    </div>
  );
}
