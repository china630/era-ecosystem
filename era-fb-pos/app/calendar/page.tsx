"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import {
  CARD_CLASS,
  INPUT_CLASS,
  PRIMARY_BTN_CLASS,
} from "@/lib/design-system";

type Table = { id: string; code: string; name: string };
type Booking = {
  id: string;
  startAt: string;
  endAt: string;
  guestName: string | null;
  partySize: number;
  table: { code: string };
};

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tableId, setTableId] = useState("");
  const [startAt, setStartAt] = useState("19:00");
  const [endAt, setEndAt] = useState("21:00");
  const [guestName, setGuestName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tRes, bRes] = await Promise.all([
      fetch("/api/tables"),
      fetch(`/api/reservations?date=${date}`),
    ]);
    if (tRes.ok) {
      const tableRows = await tRes.json();
      setTables(tableRows);
      if (tableRows[0] && !tableId) setTableId(tableRows[0].id);
    }
    if (bRes.ok) setBookings(await bRes.json());
  }, [date, tableId]);

  useEffect(() => {
    load();
  }, [load]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId,
        startAt: `${date}T${startAt}:00`,
        endAt: `${date}T${endAt}:00`,
        guestName: guestName || undefined,
        partySize: 4,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t("reserved") : data.error ?? t("failed"));
    await load();
  }

  async function openTicket(bookingId: string) {
    const res = await fetch(`/api/reservations/${bookingId}/open-ticket`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? t("failed"));
      return;
    }
    setMsg(`${t("openTicket")}: ${data.id?.slice(0, 8) ?? ""}`);
  }

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      {msg && <p className="mb-3 text-sm text-[#7F8C8D]">{msg}</p>}
      <div className={`${CARD_CLASS} mb-6 p-4`}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${INPUT_CLASS} mb-4`}
        />
        <form onSubmit={book} className="flex flex-wrap gap-2">
          <select
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className={INPUT_CLASS}
          >
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.code}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            type="time"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            placeholder={t("guest")}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className={INPUT_CLASS}
          />
          <button type="submit" className={PRIMARY_BTN_CLASS}>
            {t("book")}
          </button>
        </form>
      </div>
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-[#EBEDF0] text-left text-[#7F8C8D]">
            <tr>
              <th className="px-4 py-2">{t("table")}</th>
              <th className="px-4 py-2">{t("time")}</th>
              <th className="px-4 py-2">{t("guest")}</th>
              <th className="px-4 py-2">{t("pax")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-[#D5DADF]">
                <td className="px-4 py-2">{b.table.code}</td>
                <td className="px-4 py-2">
                  {b.startAt.slice(11, 16)}–{b.endAt.slice(11, 16)}
                </td>
                <td className="px-4 py-2">{b.guestName ?? "—"}</td>
                <td className="px-4 py-2">{b.partySize}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-[#2980B9] underline"
                    onClick={() => void openTicket(b.id)}
                  >
                    {t("openTicket")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
