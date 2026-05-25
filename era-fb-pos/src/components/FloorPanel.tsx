"use client";

import { useCallback, useEffect, useState } from "react";
import { CARD_CLASS } from "@/lib/design-system";

type Table = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type MenuItem = {
  id: string;
  plu: string;
  name: string;
  priceAzn: string | number;
};

export default function FloorPanel() {
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tablesRes, menuRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/menu"),
    ]);
    const tablesData = await tablesRes.json();
    const menuData = await menuRes.json();
    setTables(Array.isArray(tablesData) ? tablesData : []);
    const items = Array.isArray(menuData)
      ? menuData.flatMap(
          (cat: { items?: MenuItem[] }) => cat.items ?? [],
        )
      : [];
    setMenuItems(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openTicket(table: Table) {
    setMessage("");
    const defaultLine = menuItems[0];
    const lines = defaultLine
      ? [
          {
            description: defaultLine.name,
            qty: 1,
            unitPriceAzn: Number(defaultLine.priceAzn),
            menuItemPlu: defaultLine.plu,
          },
        ]
      : [{ description: "Table service", qty: 1, unitPriceAzn: 0 }];

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletCode: "RESTAURANT",
        tableId: table.id,
        covers: 2,
        lines,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to open ticket");
      return;
    }
    setMessage(`Ticket opened on ${table.code} — ${Number(data.totalAzn).toFixed(2)} AZN`);
    await load();
  }

  return (
    <>
      {message && <p className="mb-3 text-sm">{message}</p>}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tables.length === 0 && (
            <p className={`${CARD_CLASS} col-span-full p-4 text-sm text-[#7F8C8D]`}>
              No tables — run seed or POST /api/tables.
            </p>
          )}
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void openTicket(t)}
              disabled={t.status === "OCCUPIED"}
              className={`${CARD_CLASS} p-4 text-left transition hover:border-[#2980B9] disabled:opacity-60`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{t.code}</span>
                <span className="rounded-lg bg-[#EBEDF0] px-2 py-0.5 text-xs">
                  {t.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#7F8C8D]">{t.name}</p>
              <p className="mt-2 text-xs text-[#2980B9]">
                {t.status === "FREE" ? "Tap to open ticket" : "Occupied"}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
