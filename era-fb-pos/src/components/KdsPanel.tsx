"use client";

import { useCallback, useEffect, useState } from "react";
import { CARD_CLASS } from "@/lib/design-system";

type KdsLine = {
  id: string;
  description: string;
  qty: number;
  kitchenStatus: string;
  notes?: string | null;
  ticket: {
    table?: { code: string } | null;
    outlet: { code: string };
  };
};

export default function KdsPanel() {
  const [lines, setLines] = useState<KdsLine[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/kds/lines");
    const data = await res.json();
    setLines(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [load]);

  async function markDone(lineId: string) {
    setMessage("");
    const res = await fetch(`/api/kds/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kitchenStatus: "DONE" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Update failed");
      return;
    }
    setMessage(`Line done: ${data.description}`);
    await load();
  }

  return (
    <>
      {message && <p className="mb-3 text-sm">{message}</p>}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">Loading…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lines.length === 0 && (
            <p className={`${CARD_CLASS} col-span-full p-4 text-sm text-[#7F8C8D]`}>
              Kitchen queue empty.
            </p>
          )}
          {lines.map((line) => (
            <div
              key={line.id}
              className={`${CARD_CLASS} border-l-4 border-[#2980B9] p-4`}
            >
              <p className="text-xs uppercase text-[#7F8C8D]">
                {line.ticket.table?.code ?? "—"} · {line.ticket.outlet.code}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {line.qty}× {line.description}
              </p>
              <p className="text-sm text-[#2980B9]">{line.kitchenStatus}</p>
              {line.notes && (
                <p className="mt-2 text-xs text-[#7F8C8D]">{line.notes}</p>
              )}
              {line.kitchenStatus !== "DONE" && (
                <button
                  type="button"
                  className="mt-3 rounded bg-[#27AE60] px-3 py-1 text-sm text-white"
                  onClick={() => void markDone(line.id)}
                >
                  Mark done
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
