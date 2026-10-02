"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { showApiError, showSuccess } from "@era/satellite-kit/ui";
import { bakuTimeLabel } from "@era/satellite-kit/time";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";
import { CheckLines } from "@/components/CheckLines";

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
  dayNo?: number | null;
  totalAzn: string | number;
  discountPercent?: string | number;
  serviceChannel?: string | null;
  walkInLabel?: string | null;
  beoId?: string | null;
  roomChargeReservationId?: string | null;
  guestName?: string | null;
  openedAt?: string | null;
  table?: { code: string; name?: string | null } | null;
  outlet: { code: string };
  lines: TicketLine[];
};

function ticketLabel(ticket: Ticket, takeaway: string, walkIn: string): string {
  if (ticket.table) return ticket.table.name?.trim() || ticket.table.code;
  if (ticket.serviceChannel === "TAKEAWAY" || ticket.serviceChannel === "WALK_IN") {
    return takeaway;
  }
  if (ticket.beoId) return `BEO ${ticket.beoId.slice(0, 8)}`;
  return ticket.walkInLabel?.trim() || walkIn;
}

function isInHouseTicket(ticket: Ticket): boolean {
  if (ticket.roomChargeReservationId?.trim()) return true;
  return ticket.serviceChannel === "ROOM_SERVICE";
}

export default function OrdersPanel() {
  const t = useTranslations("orders");
  const tf = useTranslations("floor");
  const tc = useTranslations("common");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountInput, setDiscountInput] = useState("0");
  const [splitLineIds, setSplitLineIds] = useState<string[]>([]);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestResults, setGuestResults] = useState<InHouseGuest[]>([]);
  const [guestSearching, setGuestSearching] = useState(false);
  const [entitlements, setEntitlements] = useState<GuestEntitlements | null>(null);
  const [deferWalkInToHub, setDeferWalkInToHub] = useState(false);
  const [hotelMode, setHotelMode] = useState(false);
  const [hasKds, setHasKds] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [lastPaid, setLastPaid] = useState<{
    dayNo: number | null;
    amount: number;
    change: number | null;
  } | null>(null);

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
    void fetch("/api/edition")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const kafe = d.edition === "kafe" || d.hotelMode === false;
        setHotelMode(!kafe);
        setHasKds(
          !kafe ||
            (Array.isArray(d.activeModules) &&
              d.activeModules.includes("fnb_kitchen_kds")),
        );
      })
      .catch(() => undefined);
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
    if (!hotelMode || !resId) {
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
  }, [hotelMode, selected?.roomChargeReservationId]);

  async function fireTicket() {
    if (!selected) return;
    const res = await fetch(`/api/tickets/${selected.id}/fire`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, "Fire failed");
      return;
    }
    showSuccess(`Fired ${data.firedCount} line(s) to kitchen`);
    await load();
  }

  async function pay(method: "CASH" | "CARD" | "TRANSFER") {
    if (!selected) return;
    const persisted = await persistDiscount();
    if (persisted == null) return;
    const due = persisted;
    const got = Number(cashReceived);
    if (method === "CASH" && (!Number.isFinite(got) || got + 0.001 < due)) {
      showApiError({ error: tf("cashShort") });
      return;
    }
    const paidDay = selected.dayNo ?? null;
    const res = await fetch(`/api/tickets/${selected.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    }).catch(() => null);
    if (!res || (!res.ok && typeof navigator !== "undefined" && !navigator.onLine)) {
      window.dispatchEvent(
        new CustomEvent("era-fnb-offline", {
          detail: { kind: "pay", ticketId: selected.id, payload: { method } },
        }),
      );
      showApiError({ error: t("queuedOffline") });
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "SHIFT_REQUIRED") {
        showApiError({ error: tf("shiftRequired") });
        return;
      }
      showApiError(
        data.error === "Nothing to pay" ? { error: t("nothingToPay") } : data,
        tc("failed"),
      );
      return;
    }
    const amount = Number(data.amount);
    setLastPaid({
      dayNo: paidDay,
      amount,
      change: method === "CASH" ? Math.round((got - amount) * 100) / 100 : null,
    });
    setCashReceived("");
    setSelectedId(null);
    await load();
  }

  async function deferToHub() {
    if (!selected) return;
    const res = await fetch(`/api/tickets/${selected.id}/defer-to-hub`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("deferFailed"));
      return;
    }
    showSuccess(t("deferSuccess"));
    setSelectedId(null);
    await load();
  }

  async function searchInHouseGuests() {
    const q = guestQuery.trim();
    if (!q) return;
    setGuestSearching(true);
    try {
      const res = await fetch(`/api/in-house?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setGuestResults(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        showApiError({ error: t("guestNotFound") });
      }
    } finally {
      setGuestSearching(false);
    }
  }

  async function linkInHouseGuest(guest: InHouseGuest) {
    if (!selected) return;
    if (!guest.allowRoomCharge) {
      showApiError({ error: t("guestRoomChargeBlocked") });
      return;
    }
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
      showApiError(data, t("guestLinkFailed"));
      return;
    }
    showSuccess(t("guestLinked", { room: guest.roomNumber, name: guest.guestName }));
    setGuestResults([]);
    setGuestQuery("");
    await load();
    setSelectedId(selected.id);
  }

  async function clearGuestLink() {
    if (!selected) return;
    const res = await fetch(`/api/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomChargeReservationId: null, guestName: null }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), t("guestLinkFailed"));
      return;
    }
    await load();
    setSelectedId(selected.id);
  }

  async function roomCharge() {
    if (!selected) return;
    const res = await fetch(`/api/tickets/${selected.id}/room-charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, "Room charge failed");
      return;
    }
    showSuccess(t("roomChargeOk"));
    setSelectedId(null);
    await load();
  }

  async function changeQty(lineId: string, qty: number) {
    if (!selected) return;
    const res = await fetch(`/api/tickets/${selected.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.code === "SHIFT_REQUIRED") {
        showApiError({ error: tf("shiftRequired") });
        return;
      }
      showApiError(data, tc("failed"));
      return;
    }
    await load();
  }

  async function persistDiscount(): Promise<number | null> {
    if (!selected) return null;
    const raw = discountInput.trim() === "" ? 0 : Number(discountInput);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      showApiError({ error: t("discountPercent") });
      return null;
    }
    const stored = Number(selected.discountPercent ?? 0);
    if (Math.abs(raw - stored) < 0.001) return Number(selected.totalAzn);
    const res = await fetch(`/api/tickets/${selected.id}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPercent: raw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403) showApiError({ error: t("discountDenied") });
      else showApiError(data, t("discountPercent"));
      return null;
    }
    await load();
    return Number(data.totalAzn);
  }

  async function splitTicket() {
    if (!selected || splitLineIds.length === 0) return;
    const res = await fetch(`/api/tickets/${selected.id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineIds: splitLineIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "SHIFT_STALE" || data.code === "SHIFT_REQUIRED") {
        showApiError({ error: tf(data.code === "SHIFT_STALE" ? "shiftStale" : "shiftRequired") });
        return;
      }
      showApiError(data, t("splitSelected"));
      return;
    }
    showSuccess(t("splitSelected"));
    setSplitLineIds([]);
    await load();
  }

  function toggleSplitLine(lineId: string) {
    setSplitLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId],
    );
  }

  function statusLabel(status: string): string {
    if (status === "OPEN") return t("status_OPEN");
    if (status === "HELD") return t("status_HELD");
    if (status === "PENDING_HUB") return t("status_PENDING_HUB");
    if (status === "CLOSED") return t("status_CLOSED");
    if (status === "VOID") return t("status_VOID");
    return status;
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:overflow-hidden lg:grid-cols-2">
      <div className="min-h-0 space-y-3 overflow-y-auto">
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
              className={`${CARD_CLASS} flex h-24 w-full flex-col p-3 text-left ${
                selected?.id === ticket.id ? "border-[#2980B9] bg-[#EAF3FB]" : ""
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-base font-semibold">
                  {ticketLabel(ticket, t("channelTakeaway"), t("channelWalkIn"))}
                  {ticket.dayNo ? ` #${ticket.dayNo}` : ""}
                  {ticket.beoId ? " · BEO" : ""}
                </span>
                {ticket.status !== "OPEN" ? (
                  <span className="shrink-0 text-xs text-[#7F8C8D]">{statusLabel(ticket.status)}</span>
                ) : null}
              </span>
              <span className="mt-auto flex items-end justify-between gap-2">
                <span className="text-xs text-[#7F8C8D]">
                  {ticket.openedAt ? bakuTimeLabel(ticket.openedAt) : statusLabel(ticket.status)}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {Number(ticket.totalAzn).toFixed(2)} {tc("azn")}
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className={`${CARD_CLASS} flex min-h-0 flex-col overflow-hidden p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t("ticketActions")}</h2>
        {!selected ? (
          <p className="text-sm text-[#7F8C8D]">
            {lastPaid
              ? tf("paidBanner", {
                  no: lastPaid.dayNo ?? "—",
                  amount: lastPaid.amount.toFixed(2),
                  change:
                    lastPaid.change == null
                      ? ""
                      : tf("changeDue", { amount: lastPaid.change.toFixed(2) }),
                })
              : t("selectTicket")}
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-[#34495E]">
              {ticketLabel(selected, t("channelTakeaway"), t("channelWalkIn"))}
              {selected.dayNo ? ` #${selected.dayNo}` : ""}
            </p>
            <div className="mb-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <CheckLines
                lines={selected.lines.filter((l) => l.kitchenStatus !== "VOID")}
                onQty={(line, qty) => void changeQty(line.id, qty)}
                onRemove={(line) => void changeQty(line.id, 0)}
                onToggle={hotelMode ? (line) => toggleSplitLine(line.id) : undefined}
                selectedIds={splitLineIds}
                azn={tc("azn")}
                labels={{
                  name: t("colName"),
                  qty: t("colQty"),
                  price: t("colPrice"),
                  sum: t("colSum"),
                  minus: t("qtyMinus"),
                  plus: t("qtyPlus"),
                  remove: t("void"),
                }}
                discount={(() => {
                  const gross = selected.lines
                    .filter((l) => l.kitchenStatus !== "VOID")
                    .reduce((sum, line) => sum + line.qty * Number(line.unitPriceAzn), 0);
                  const pct = Math.min(100, Math.max(0, Number(discountInput) || 0));
                  const net = Math.round(gross * (1 - pct / 100) * 100) / 100;
                  const amount = Math.round((gross - net) * 100) / 100;
                  return {
                    label: t("discountPercent"),
                    value: discountInput,
                    onChange: setDiscountInput,
                    onBlur: () => void persistDiscount(),
                    amountText: pct > 0 ? `−${amount.toFixed(2)} ${tc("azn")}` : null,
                    netText: `${net.toFixed(2)} ${tc("azn")}`,
                  };
                })()}
                tender={
                  hotelMode && (inHouse || selected.roomChargeReservationId || deferWalkInToHub)
                    ? undefined
                    : {
                        label: tf("cashReceived"),
                        value: cashReceived,
                        onChange: setCashReceived,
                      }
                }
              />
            </div>
            {hotelMode ? (
            <div className="mb-3 shrink-0">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
                disabled={splitLineIds.length === 0}
                onClick={() => void splitTicket()}
              >
                {t("splitSelected")}
              </button>
            </div>
            ) : null}
            {hotelMode ? (
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
            ) : null}
            <div className="flex shrink-0 flex-wrap gap-2">
              {hasKds ? (
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                onClick={() => void fireTicket()}
              >
                {t("fireKitchen")}
              </button>
              ) : null}
              {hotelMode && (inHouse || selected.roomChargeReservationId) ? (
                <button
                  type="button"
                  className="rounded bg-[#8E44AD] px-3 py-1.5 text-sm text-white"
                  onClick={() => void roomCharge()}
                >
                  {t("roomCharge")}
                </button>
              ) : hotelMode && deferWalkInToHub ? (
                <button
                  type="button"
                  className="rounded bg-[#D35400] px-3 py-1.5 text-sm text-white"
                  onClick={() => void deferToHub()}
                >
                  {t("sendToReception")}
                </button>
              ) : (
                <div className="flex w-full shrink-0 flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
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
                  <button
                    type="button"
                    className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white"
                    onClick={() => void pay("TRANSFER")}
                  >
                    {t("payTransfer")}
                  </button>
                  </div>
                </div>
              )}
              {hasKds ? (
              <Link
                href="/kds"
                className="rounded border px-3 py-1.5 text-sm text-[#2980B9]"
              >
                {t("openKds")}
              </Link>
              ) : null}
            </div>
          </>
        )}
        {selected && hotelMode && inHouse && (
          <p className="mt-2 text-xs text-[#8E44AD]">{t("inHouseHint")}</p>
        )}
      </div>
    </div>
  );
}
