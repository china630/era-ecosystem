"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type TableCard = {
  id: string;
  code: string;
  name: string;
  status: string;
  openTotalAzn: number | null;
  openedAt: string | null;
  waiterLabel: string | null;
  covers: number | null;
  currentTicketId: string | null;
};

export default function HallGridPage() {
  const t = useTranslations("hallPages");
  const nav = useTranslations("nav");
  const [tables, setTables] = useState<TableCard[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "mine">("all");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const res = await fetch("/api/tables");
    if (!res.ok) {
      setError(t("tablesUnavailable"));
      return;
    }
    setTables(await res.json());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function createTable(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name: code }),
    });
    if (!res.ok) {
      setError(t("managerOnly"));
      return;
    }
    setCode("");
    await reload();
  }

  const visible = tables.filter((table) => {
    if (filter === "open") return table.status === "OCCUPIED";
    return true;
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{nav("hall")}</h1>
        {(["all", "open"] as const).map((key) => (
          <button key={key} type="button" className="rounded border px-2 py-1 text-sm" onClick={() => setFilter(key)}>
            {key === "all" ? t("all") : t("open")}
          </button>
        ))}
        <form onSubmit={createTable} className="ml-auto flex gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("newTable")} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="rounded border px-2 py-1 text-sm" type="submit">{t("add")}</button>
        </form>
      </div>
      {error ? <p className="text-sm">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {visible.map((table) => (
          <a
            key={table.id}
            href={table.currentTicketId ? `/orders?ticket=${table.currentTicketId}` : "/orders"}
            className={`block rounded border p-3 text-sm ${table.status === "OCCUPIED" ? "bg-neutral-900 text-white" : ""}`}
          >
            <div className="text-lg font-semibold">{table.code}</div>
            {table.status === "OCCUPIED" ? (
              <>
                <div>{table.currentTicketId?.slice(0, 8)}</div>
                <div>{table.waiterLabel ?? "—"}</div>
                <div>{table.covers ?? 1} pax</div>
                <div>{table.openTotalAzn?.toFixed(2) ?? "0.00"}</div>
                <div>{table.openedAt ? new Date(table.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku" }) : ""}</div>
              </>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  );
}
