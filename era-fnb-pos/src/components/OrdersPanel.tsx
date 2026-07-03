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

type InHouseGuest = {
  reservationId: string;
  roomNumber: string;
  guestName: string;
  allowRoomCharge: boolean;
};

type GuestEntitlements = {
  found: boolean;
  breakfastIncluded?: boolean;
  mealPlanCode?: string | null;
  allInclusive?: boolean;
};

type Ticket = {
  id: string;
  status: string;
  totalAzn: string | number;
  discountPercent?: string | number;
  serviceChannel?: string | null;
  walkInLabel?: string | null;
  beoId?: string | null;
  roomChargeReservationId?: string | null;
  guestName?: string | null;
  table?: { code: string } | null;
  outlet: { code: string };
  lines: TicketLine[];
};

function ticketLabel(ticket: Ticket): string {
  if (ticket.table?.code) return ticket.table.code;
  if (ticket.serviceChannel === "WALK_IN") {
    return ticket.walkInLabel?.trim() || "Walk-in";
  }
  if (ticket.beoId) return `BEO ${ticket.beoId.slice(0, 8)}`;
  return "Walk-in";
}

function isInHouseTicket(ticket: Ticket): boolean {
  if (ticket.roomChargeReservationId?.trim()) return true;
  return ticket.serviceChannel === "ROOM_SERVICE";
}

export default function OrdersPanel() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [discountInput, setDiscountInput] = useState("0");
  const [splitLineIds, setSplitLineIds] = useState<string[]>([]);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestResults, setGuestResults] = useState<InHouseGuest[]>([]);
  const [guestSearching, setGuestSearching] = useState(false);
  const [entitlements, setEntitlements] = useState<GuestEntitlements | null>(null);
  const [deferWalkInToHub, setDeferWalkInToHub] = useState(false);

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

  useEffect(() => {
    void fetch("/api/billing/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDeferWalkInToHub(Boolean(data.deferWalkInToHub));
      })
      .catch(() => setDeferWalkInToHub(false));
  }, []);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;
  const inHouse = selected ? isInHouseTicket(selected) : false;

  useEffect(() => {
    if (selected) {
      setDiscountInput(String(Number(selected.discountPercent ?? 0)));
      setSplitLineIds([]);
    }
  }, [selected?.id, selected?.discountPercent]);

  useEffect(() => {
    const resId = selected?.roomChargeReservationId?.trim();
    if (!resId) {
      setEntitlements(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/pms/guest-entitlements?reservationId=${encodeURIComponent(resId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setEntitlements(data as GuestEntitlements);
      })
      .catch(() => {
        if (!cancelled) setEntitlements(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.roomChargeReservationId]);

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

  async function pay(method: "CASH" | "CARD") {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Payment failed");
      return;
    }
    const label = method === "CARD" ? t("payCard") : t("payCash");
    setMessage(`${label}: ${Number(data.amount).toFixed(2)} ${tc("azn")} (stub fiscal)`);
    setSelectedId(null);
    await load();
  }

  async function deferToHub() {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/defer-to-hub`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("deferFailed"));
      return;
    }
    setMessage(t("deferSuccess"));
    setSelectedId(null);
    await load();
  }

  async function searchInHouseGuests() {
    const q = guestQuery.trim();
    if (!q) return;
    setGuestSearching(true);
    setMessage("");
    try {
      const res = await fetch(`/api/in-house?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setGuestResults(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        setMessage(t("guestNotFound"));
      }
    } finally {
      setGuestSearching(false);
    }
  }

  async function linkInHouseGuest(guest: InHouseGuest) {
    if (!selected) return;
    if (!guest.allowRoomCharge) {
      setMessage(t("guestRoomChargeBlocked"));
      return;
    }
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomChargeReservationId: guest.reservationId,
        guestName: guest.guestName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("guestLinkFailed"));
      return;
    }
    setMessage(t("guestLinked", { room: guest.roomNumber, name: guest.guestName }));
    setGuestResults([]);
    setGuestQuery("");
    await load();
    setSelectedId(selected.id);
  }

  async function clearGuestLink() {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomChargeReservationId: null, guestName: null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? t("guestLinkFailed"));
      return;
    }
    await load();
    setSelectedId(selected.id);
  }

  async function roomCharge() {
    if (!selected) return;
    setMessage("");
    const res = await fetch(`/api/tickets/${selected.id}/room-charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Room charge failed");
      return;
    }
    setMessage(t("roomChargeOk"));
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
                  {ticketLabel(ticket)} · {ticket.outlet.code}
                  {ticket.serviceChannel === "WALK_IN" ? " · WALK_IN" : ""}
                  {ticket.beoId ? " · BEO" : ""}
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
            <div className="mb-3 rounded border border-[#ECF0F1] bg-[#FAFBFC] p-3">
              <p className="mb-2 text-xs font-medium text-[#7F8C8D]">{t("inHouseGuest")}</p>
              {selected.roomChargeReservationId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[#8E44AD]">
                    {t("guestLinkedLabel", {
                      name: selected.guestName ?? t("guestUnknown"),
                      id: selected.roomChargeReservationId.slice(0, 8),
                    })}
                  </span>
                  {entitlements?.found && (
                    <span className="flex flex-wrap gap-1 text-xs">
                      {entitlements.allInclusive && (
                        <span className="rounded bg-[#27AE60]/15 px-1.5 py-0.5 text-[#27AE60]">
                          {t("mealAllInclusive")}
                        </span>
                      )}
                      {entitlements.breakfastIncluded && !entitlements.allInclusive && (
                        <span className="rounded bg-[#2980B9]/15 px-1.5 py-0.5 text-[#2980B9]">
                          {t("mealBreakfast")}
                        </span>
                      )}
                      {entitlements.mealPlanCode && (
                        <span className="rounded bg-[#ECF0F1] px-1.5 py-0.5 text-[#7F8C8D]">
                          {entitlements.mealPlanCode}
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-[#7F8C8D]"
                    onClick={() => void clearGuestLink()}
                  >
                    {t("clearGuestLink")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={guestQuery}
                      onChange={(e) => setGuestQuery(e.target.value)}
                      placeholder={t("guestSearchPlaceholder")}
                      className={`${INPUT_CLASS} min-w-[12rem] flex-1`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void searchInHouseGuests();
                      }}
                    />
                    <button
                      type="button"
                      className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
                      disabled={guestSearching || !guestQuery.trim()}
                      onClick={() => void searchInHouseGuests()}
                    >
                      {guestSearching ? t("guestSearching") : t("guestSearch")}
                    </button>
                  </div>
                  {guestResults.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {guestResults.map((g) => (
                        <li key={g.reservationId}>
                          <button
                            type="button"
                            className="w-full rounded border border-[#ECF0F1] px-2 py-1 text-left hover:bg-white"
                            onClick={() => void linkInHouseGuest(g)}
                          >
                            {t("guestResultRow", {
                              room: g.roomNumber,
                              name: g.guestName,
                            })}
                            {!g.allowRoomCharge ? ` (${t("guestNoCharge")})` : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                onClick={() => void fireTicket()}
              >
                {t("fireKitchen")}
              </button>
              {inHouse || selected.roomChargeReservationId ? (
                <button
                  type="button"
                  className="rounded bg-[#8E44AD] px-3 py-1.5 text-sm text-white"
                  onClick={() => void roomCharge()}
                >
                  {t("roomCharge")}
                </button>
              ) : deferWalkInToHub ? (
                <button
                  type="button"
                  className="rounded bg-[#D35400] px-3 py-1.5 text-sm text-white"
                  onClick={() => void deferToHub()}
                >
                  {t("sendToReception")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded bg-[#27AE60] px-3 py-1.5 text-sm text-white"
                    onClick={() => void pay("CASH")}
                  >
                    {t("payCash")}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#16A085] px-3 py-1.5 text-sm text-white"
                    onClick={() => void pay("CARD")}
                  >
                    {t("payCard")}
                  </button>
                </>
              )}
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
        {selected && inHouse && (
          <p className="mt-2 text-xs text-[#8E44AD]">{t("inHouseHint")}</p>
        )}
        <p className="mt-3 text-xs text-[#7F8C8D]">{t("roleHint")}</p>
      </div>
    </div>
  );
}
