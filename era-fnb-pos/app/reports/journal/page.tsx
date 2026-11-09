"use client";

import { useEffect, useState } from "react";
import { ticketCode } from "@/components/SlipTape";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  dayNo: number | null;
  open: boolean;
  table: string | null;
  openedAt: string;
  closedAt: string | null;
  cash: number;
  card: number;
  discountPercent: number;
  total: number;
  room: string | null;
  guestName: string | null;
  holder: string | null;
  terminal: string | null;
  voidedTicketId: string | null;
  route: string;
  tone: "till" | "room" | "limit" | "ikram" | "other";
};

const TONE: Record<Row["tone"], string> = {
  till: "bg-white",
  room: "bg-amber-100",
  limit: "bg-purple-100",
  ikram: "bg-neutral-100",
  other: "bg-white",
};

export default function ManagerJournalPage() {
  const t = useTranslations("hallPages");
  const nav = useTranslations("nav");
  const [rows, setRows] = useState<Row[]>([]);
  const [tone, setTone] = useState<Row["tone"] | "all">("all");
  const [find, setFind] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/reports/journal")
      .then(async (res) => {
        if (!res.ok) {
          setError(t("unavailable"));
          return;
        }
        const body = await res.json();
        setRows(body.rows ?? []);
      })
      .catch(() => setError(t("unavailable")));
  }, [t]);

  const needle = find.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (tone !== "all" && row.tone !== tone) return false;
    if (!needle) return true;
    const code = ticketCode(row.id).toLowerCase();
    return code.includes(needle) || String(row.dayNo ?? "").includes(needle);
  });
  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku" })
      : "—";

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-semibold">{t("journal")}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "till", "room", "limit", "ikram"] as const).map((key) => (
          <button key={key} type="button" className="rounded border px-2 py-1" onClick={() => setTone(key)}>
            {t(key === "all" ? "filterAll" : key === "till" ? "toneTill" : key === "room" ? "toneRoom" : key === "limit" ? "toneLimit" : "toneIkram")}
          </button>
        ))}
        <a className="rounded border px-2 py-1" href="/reports/x">{nav("xReport")}</a>
        <input
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder={t("findCheck")}
          className="rounded border px-2 py-1"
        />
      </div>
      {error ? <p className="text-sm">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th className="p-2">{t("check")}</th>
              <th className="p-2">{t("table")}</th>
              <th className="p-2">{t("opened")}</th>
              <th className="p-2">{t("closed")}</th>
              <th className="p-2">{t("cash")}</th>
              <th className="p-2">{t("card")}</th>
              <th className="p-2">{t("discount")}</th>
              <th className="p-2">{t("total")}</th>
              <th className="p-2">{t("room")}</th>
              <th className="p-2">{t("limit")}</th>
              <th className="p-2">{t("voided")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className={`border-b ${TONE[row.tone]}`}>
                <td className="p-2">
                  <a className="underline" href={row.open ? `/floor?ticket=${row.id}` : `/floor?ticket=${row.id}&view=1`}>{row.dayNo ?? "—"} · {ticketCode(row.id)}</a>
                </td>
                <td className="p-2">{row.table ?? "—"}</td>
                <td className="p-2">{time(row.openedAt)}</td>
                <td className="p-2">{time(row.closedAt)}</td>
                <td className="p-2">{row.cash ? row.cash.toFixed(2) : ""}</td>
                <td className="p-2">{row.card ? `${row.card.toFixed(2)}${row.terminal ? ` ${row.terminal}` : ""}` : ""}</td>
                <td className="p-2">{row.discountPercent ? `${row.discountPercent}%` : ""}</td>
                <td className="p-2">{row.total.toFixed(2)}</td>
                <td className="p-2">{row.room ?? ""} {row.guestName ?? ""}</td>
                <td className="p-2">{row.holder ?? ""}</td>
                <td className="p-2">{row.voidedTicketId ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
