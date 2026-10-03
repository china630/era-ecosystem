"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ColorLegend, showApiError, showSuccess } from "@era/satellite-kit/ui";
import { Ban } from "lucide-react";
import { bakuTimeLabel } from "@era/satellite-kit/time";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";
import { fnbCan } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CheckLines } from "@/components/CheckLines";
import PosShiftPanel from "@/components/PosShiftPanel";

type Table = {
  id: string;
  code: string;
  name: string;
  status: string;
  hall?: { id: string; name: string; sortOrder?: number } | null;
  currentTicketId?: string | null;
  openTotalAzn?: number | null;
  openedAt?: string | null;
};

type MenuItem = {
  id: string;
  plu: string;
  name: string;
  priceAzn: string | number;
  imageUrl?: string | null;
  categoryId?: string;
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type TicketLineView = {
  id: string;
  description: string;
  qty: number;
  unitPriceAzn: string | number;
  menuItemId?: string | null;
  kitchenStatus?: string;
};

type OpenChip = {
  id: string;
  dayNo: number | null;
  totalAzn: string | number;
  serviceChannel?: string | null;
  tableId?: string | null;
  openedAt?: string | null;
};

type Outlet = {
  id: string;
  code: string;
  name: string;
};

type BanquetEvent = {
  id: string;
  eventName: string;
  eventDate: string;
  pax: number;
  status: string;
  referenceNo?: string | null;
};

type Draft =
  | { kind: "table"; tableId: string; code: string }
  | { kind: "takeaway" }
  | null;

function liveLines(lines: TicketLineView[]): TicketLineView[] {
  return lines.filter((line) => line.kitchenStatus !== "VOID");
}

export default function FloorPanel() {
  const t = useTranslations("floor");
  const tc = useTranslations("common");

  const [tables, setTables] = useState<Table[]>([]);
  const [hallFilter, setHallFilter] = useState<string | null>(null);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [ticketLines, setTicketLines] = useState<TicketLineView[]>([]);
  const [ticketTotal, setTicketTotal] = useState<number | null>(null);
  const [ticketCaption, setTicketCaption] = useState("");
  const [dayNo, setDayNo] = useState<number | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [storedDiscount, setStoredDiscount] = useState(0);
  const [lastPaid, setLastPaid] = useState<{
    dayNo: number | null;
    amount: number;
    change: number | null;
  } | null>(null);
  const [openChips, setOpenChips] = useState<OpenChip[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [banquets, setBanquets] = useState<BanquetEvent[]>([]);
  const [selectedBeoId, setSelectedBeoId] = useState("");
  const [walkInLabel, setWalkInLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [outletSaving, setOutletSaving] = useState(false);
  const [hotelMode, setHotelMode] = useState(false);
  const hotelModeRef = useRef(false);
  const autoOpenedRef = useRef(false);
  const [soldOutIds, setSoldOutIds] = useState<Set<string>>(new Set());
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [canPay, setCanPay] = useState(true);
  const [canSoldOut, setCanSoldOut] = useState(false);
  const busy = useRef(false);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;
  const outletCode = selectedOutlet?.code ?? "";

  const applyTicket = useCallback(
    (data: {
      id?: string;
      lines?: TicketLineView[];
      totalAzn?: string | number;
      dayNo?: number | null;
      table?: { code?: string; name?: string | null } | null;
      walkInLabel?: string | null;
      serviceChannel?: string | null;
      discountPercent?: string | number | null;
      status?: string;
      released?: boolean;
    }, caption?: string) => {
      if (data.released || data.status === "VOID") {
        setActiveTicketId(null);
        setDraft(null);
        setTicketLines([]);
        setTicketTotal(null);
        setTicketCaption("");
        setDayNo(null);
        setStoredDiscount(0);
        return;
      }
      if (typeof data.id === "string") setActiveTicketId(data.id);
      const lines = liveLines(Array.isArray(data.lines) ? data.lines : []);
      setTicketLines(lines);
      setTicketTotal(Number(data.totalAzn) || 0);
      if (data.discountPercent != null) setStoredDiscount(Number(data.discountPercent) || 0);
      if (typeof data.dayNo === "number") setDayNo(data.dayNo);
      const tableCode = data.table?.name?.trim() || data.table?.code;
      const takeaway =
        data.serviceChannel === "TAKEAWAY" || data.serviceChannel === "WALK_IN";
      setTicketCaption(
        caption ||
          tableCode ||
          (takeaway ? t("takeaway") : data.walkInLabel) ||
          "",
      );
      setDraft(null);
    },
    [t],
  );

  const loadChips = useCallback(async () => {
    const res = await fetch("/api/tickets");
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) {
      setOpenChips([]);
      return [] as OpenChip[];
    }
    const chips: OpenChip[] = data
      .filter(
        (ticket: { serviceChannel?: string | null; table?: { id?: string } | null }) =>
          ticket.serviceChannel === "TAKEAWAY" ||
          (ticket.serviceChannel === "WALK_IN" && !ticket.table),
      )
      .map(
        (ticket: {
          id: string;
          dayNo?: number | null;
          totalAzn: string | number;
          serviceChannel?: string | null;
          openedAt?: string | null;
          table?: { id?: string } | null;
        }) => ({
          id: ticket.id,
          dayNo: ticket.dayNo ?? null,
          totalAzn: ticket.totalAzn,
          serviceChannel: ticket.serviceChannel,
          tableId: ticket.table?.id ?? null,
          openedAt: ticket.openedAt ?? null,
        }),
      );
    setOpenChips(chips);
    return chips;
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [tablesRes, menuRes, outletsRes, editionRes, soldRes, meRes, grantsRes] = await Promise.all([
        fetch("/api/tables"),
        fetch("/api/menu"),
        fetch("/api/outlets"),
        fetch("/api/edition"),
        fetch("/api/menu/sold-out"),
        fetch("/api/auth/me"),
        fetch("/api/shifts/open"),
      ]);
      const tablesData = await tablesRes.json().catch(() => null);
      const menuData = await menuRes.json().catch(() => null);
      const outletsData = await outletsRes.json().catch(() => ({}));
      const editionData = editionRes.ok
        ? await editionRes.json().catch(() => null)
        : null;
      const soldData = await soldRes.json().catch(() => ({ soldOut: [] }));
      const me = meRes.ok ? await meRes.json().catch(() => null) : null;
      const grants = grantsRes.ok ? await grantsRes.json().catch(() => null) : null;
      if (grants && grants.mayPay === false) setCanPay(false);
      else setCanPay(true);
      setCanSoldOut(fnbCan(me, PERMISSIONS.MENU_SOLD_OUT));
      const kafe = editionData
        ? String(editionData.edition ?? "").toLowerCase() === "kafe" ||
          editionData.hotelMode === false
        : !hotelModeRef.current;
      if (editionData) {
        hotelModeRef.current = !kafe;
        setHotelMode(!kafe);
      }
      if (!tablesRes.ok) {
        showApiError(tablesData, tc("failed"));
      }
      setSoldOutIds(
        new Set(
          (Array.isArray(soldData.soldOut) ? soldData.soldOut : []).map(
            (r: { menuItemId: string }) => r.menuItemId,
          ),
        ),
      );
      let banquetsData: BanquetEvent[] = [];
      let tableRows = Array.isArray(tablesData) ? tablesData : [];
      if (!kafe) {
        const banquetsRes = await fetch("/api/banquets");
        banquetsData = await banquetsRes.json().catch(() => []);
      } else {
        await fetch("/api/tickets/void-empty", { method: "POST" }).catch(() => null);
        window.dispatchEvent(new Event("era-fnb-shift-refresh"));
        const again = await fetch("/api/tables");
        const againData = await again.json().catch(() => null);
        if (Array.isArray(againData)) tableRows = againData;
      }

      setTables(tableRows);
      const cats: MenuCategory[] = Array.isArray(menuData)
        ? menuData.map((cat: { id: string; name: string; items?: MenuItem[] }) => ({
            id: cat.id,
            name: cat.name,
            items: cat.items ?? [],
          }))
        : [];
      setMenuCategories(cats);
      setActiveCategoryId((prev) =>
        prev && cats.some((c) => c.id === prev) ? prev : (cats[0]?.id ?? ""),
      );

      const outletList = Array.isArray(outletsData.outlets) ? outletsData.outlets : [];
      setOutlets(outletList);
      const sel =
        outletsData.selectedOutletId ??
        outletList.find((o: Outlet) => o.code === "KAFE")?.id ??
        outletList.find((o: Outlet) => o.code === "RESTAURANT")?.id ??
        outletList[0]?.id ??
        "";
      setSelectedOutletId(sel);

      setBanquets(Array.isArray(banquetsData) ? banquetsData : []);
      setSelectedBeoId((prev) => {
        if (prev) return prev;
        const list = Array.isArray(banquetsData) ? banquetsData : [];
        return list[0]?.id ?? "";
      });
      const chips = await loadChips();
      if (!autoOpenedRef.current) {
        autoOpenedRef.current = true;
        const occupied = tableRows.filter(
          (row: Table) => row.status === "OCCUPIED" && row.currentTicketId,
        );
        if (occupied.length + chips.length === 1) {
          if (occupied.length === 1 && occupied[0].currentTicketId) {
            void focusTicket(occupied[0].currentTicketId, occupied[0].name || occupied[0].code);
          } else if (chips[0]) {
            void focusTicket(chips[0].id, t("takeaway"));
          }
        }
      }
    } catch (err) {
      showApiError(err instanceof Error ? { error: err.message } : {}, tc("failed"));
    } finally {
      setLoading(false);
    }
  }, [loadChips, t, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectOutlet(outletId: string) {
    setSelectedOutletId(outletId);
    setOutletSaving(true);
    try {
      const res = await fetch("/api/outlets/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      showSuccess(t("outletSelected", { code: data.code ?? outletCode }));
    } finally {
      setOutletSaving(false);
    }
  }

  async function focusTicket(id: string, caption?: string) {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      showApiError(data, tc("failed"));
      return;
    }
    applyTicket(data, caption);
  }

  async function createWithLine(
    item: MenuItem,
    extra: Record<string, unknown>,
    caption: string,
  ) {
    const payload: Record<string, unknown> = {
      ...extra,
      lines: [
        {
          description: item.name,
          qty: 1,
          unitPriceAzn: Number(item.priceAzn),
          menuItemPlu: item.plu,
        },
      ],
    };
    if (typeof payload.outletCode === "string" && !payload.outletCode.trim()) {
      delete payload.outletCode;
    }
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      apiFailed(data);
      return;
    }
    applyTicket(data, caption);
    window.dispatchEvent(new Event("era-fnb-shift-refresh"));
    await load({ silent: true });
  }

  function apiFailed(data: { error?: string; code?: string }) {
    if (data.code === "SOLD_OUT") {
      showApiError({ error: t("soldOut") });
      return;
    }
    if (data.code === "SHIFT_REQUIRED") {
      showApiError({ error: t("shiftRequired") });
      return;
    }
    if (data.code === "SHIFT_STALE") {
      showApiError({ error: t("shiftStale") });
      return;
    }
    const err = data.error?.trim() ?? "";
    const prismaDump = err.includes("prisma.") || err.startsWith("Invalid `");
    showApiError(prismaDump ? { error: tc("failed") } : data, tc("failed"));
  }

  async function addDish(item: MenuItem) {
    if (busy.current) return;
    if (soldOutIds.has(item.id)) {
      showApiError({ error: t("soldOut") });
      return;
    }
    busy.current = true;
    try {
    if (activeTicketId) {
      const same = ticketLines.find(
        (line) => line.menuItemId === item.id || line.description === item.name,
      );
      if (same) {
        await changeQty(same, same.qty + 1, true);
        return;
      }
      const res = await fetch(`/api/tickets/${activeTicketId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: item.name,
          qty: 1,
          unitPriceAzn: Number(item.priceAzn),
          menuItemPlu: item.plu,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        apiFailed(data);
        return;
      }
      applyTicket({ ...data, id: activeTicketId });
      await load({ silent: true });
      return;
    }
    if (draft?.kind === "table") {
      await createWithLine(
        item,
        { outletCode, tableId: draft.tableId, serviceChannel: "DINE_IN", covers: 1 },
        draft.code,
      );
      return;
    }
    if (draft?.kind === "takeaway") {
      await createWithLine(
        item,
        { outletCode, serviceChannel: "TAKEAWAY", walkInLabel: t("takeaway") },
        t("takeaway"),
      );
      return;
    }
    showApiError({ error: t("openTableFirst") });
    } finally {
      busy.current = false;
    }
  }

  async function changeQty(line: TicketLineView, qty: number, nested = false) {
    if ((!nested && busy.current) || !activeTicketId) return;
    if (qty > line.qty) {
      const itemId = line.menuItemId;
      if (itemId && soldOutIds.has(itemId)) {
        showApiError({ error: t("soldOut") });
        return;
      }
    }
    if (!nested) busy.current = true;
    try {
      const res = await fetch(`/api/tickets/${activeTicketId}/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        apiFailed(data);
        return;
      }
      applyTicket({ ...data, id: activeTicketId });
      await load({ silent: true });
    } finally {
      if (!nested) busy.current = false;
    }
  }

  async function persistDiscount(): Promise<number | null> {
    if (!activeTicketId) return null;
    const raw = discountInput.trim() === "" ? 0 : Number(discountInput);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      showApiError({ error: t("discountPercent") });
      return null;
    }
    if (Math.abs(raw - storedDiscount) < 0.001) return ticketTotal ?? 0;
    const res = await fetch(`/api/tickets/${activeTicketId}/discount`, {
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
    setStoredDiscount(raw);
    const total = Number(data.totalAzn) || 0;
    setTicketTotal(total);
    return total;
  }

  async function pay(method: "CASH" | "CARD" | "TRANSFER") {
    if (busy.current || !activeTicketId || !canPay) return;
    const persisted = await persistDiscount();
    if (persisted == null) return;
    if (ticketLines.length === 0 || persisted <= 0) {
      showApiError({ error: t("nothingToPay") });
      return;
    }
    const due = persisted;
    const got = Number(cashReceived);
    if (method === "CASH" && (!Number.isFinite(got) || got + 0.001 < due)) {
      showApiError({ error: t("cashShort") });
      return;
    }
    busy.current = true;
    const ticketId = activeTicketId;
    const paidDay = dayNo;
    try {
    const res = await fetch(`/api/tickets/${ticketId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        ...(method === "CASH" ? { cashTendered: got } : {}),
      }),
    }).catch(() => null);
    if (!res || (!res.ok && typeof navigator !== "undefined" && !navigator.onLine)) {
      window.dispatchEvent(
        new CustomEvent("era-fnb-offline", {
          detail: {
            kind: "pay",
            ticketId,
            payload: { method, ...(method === "CASH" ? { cashTendered: got } : {}) },
          },
        }),
      );
      showApiError({ error: t("queuedOffline") });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.code === "SHIFT_REQUIRED") {
        showApiError({ error: t("shiftRequired") });
        return;
      }
      showApiError(
        data.error === "Nothing to pay"
          ? { error: t("nothingToPay") }
          : data.error === "Cash tendered is less than the check"
            ? { error: t("cashShort") }
            : data,
        tc("failed"),
      );
      return;
    }
    const amount = Number(data.amount);
    setLastPaid({
      dayNo: paidDay,
      amount,
      change: method === "CASH" ? Number(data.changeAzn ?? Math.round((got - amount) * 100) / 100) : null,
    });
    window.dispatchEvent(new Event("era-fnb-shift-refresh"));
    setCashReceived("");
    setActiveTicketId(null);
    setDraft(null);
    setTicketLines([]);
    setTicketTotal(null);
    setTicketCaption("");
    setDayNo(null);
    await load({ silent: true });
    } finally {
      busy.current = false;
    }
  }

  async function cancelTicket() {
    if (busy.current || !activeTicketId || !canPay) return;
    if (!window.confirm(t("confirmCancel"))) return;
    busy.current = true;
    try {
    const res = await fetch(`/api/tickets/${activeTicketId}/void`, { method: "POST" });
    if (!res.ok) {
      showApiError({}, tc("failed"));
      return;
    }
    showSuccess(t("ticketCancelled"));
    window.dispatchEvent(new Event("era-fnb-shift-refresh"));
    applyTicket({ id: activeTicketId, status: "VOID", released: true });
    await load({ silent: true });
    } finally {
      busy.current = false;
    }
  }

  async function toggleSoldOut(item: MenuItem) {
    if (!canSoldOut) return;
    const next = !soldOutIds.has(item.id);
    const res = await fetch("/api/menu/sold-out", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: item.id, soldOut: next }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc("failed"));
      return;
    }
    await load({ silent: true });
  }

  function selectTable(table: Table) {
    if (table.status === "OCCUPIED") {
      if (table.currentTicketId) {
        void focusTicket(table.currentTicketId, table.name || table.code);
        return;
      }
      const found = openChips.find((chip) => chip.tableId === table.id);
      if (found) {
        void focusTicket(found.id, table.name || table.code);
        return;
      }
      void (async () => {
        const res = await fetch("/api/tickets");
        const data = await res.json().catch(() => null);
        const match = Array.isArray(data)
          ? data.find(
              (ticket: { id?: string; table?: { id?: string } | null }) =>
                ticket.table?.id === table.id,
            )
          : null;
        if (match?.id) {
          await focusTicket(match.id, table.name || table.code);
          return;
        }
        showApiError({ error: t("occupiedHint") });
      })();
      return;
    }
    setActiveTicketId(null);
    setTicketLines([]);
    setTicketTotal(0);
    setDayNo(null);
    setDraft({ kind: "table", tableId: table.id, code: table.code });
    setTicketCaption(table.code);
  }

  function startTakeaway() {
    setActiveTicketId(null);
    setTicketLines([]);
    setTicketTotal(0);
    setDayNo(null);
    setDraft({ kind: "takeaway" });
    setTicketCaption(t("takeaway"));
  }

  async function openWalkIn() {
    const payload: Record<string, unknown> = {
      outletCode,
      serviceChannel: "WALK_IN",
      walkInLabel: walkInLabel.trim() || t("walkInDefaultLabel"),
      lines: [],
    };
    if (!outletCode.trim()) delete payload.outletCode;
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      apiFailed(data);
      return;
    }
    applyTicket(data, walkInLabel.trim() || t("walkInDefaultLabel"));
    window.dispatchEvent(new Event("era-fnb-shift-refresh"));
    showSuccess(t("walkInOpened", { total: Number(data.totalAzn).toFixed(2) }));
    await load({ silent: true });
  }

  async function openBanquetTicket() {
    if (!selectedBeoId) {
      showApiError({ error: t("banquetSelectRequired") });
      return;
    }
    const beo = banquets.find((b) => b.id === selectedBeoId);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletCode: "BANQUET",
        beoId: selectedBeoId,
        guestName: beo?.eventName,
        covers: beo?.pax ?? 1,
        lines: [],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      apiFailed(data);
      return;
    }
    applyTicket(data, beo?.eventName);
    window.dispatchEvent(new Event("era-fnb-shift-refresh"));
    showSuccess(t("banquetOpened", { name: beo?.eventName ?? "", total: Number(data.totalAzn).toFixed(2) }));
    await load({ silent: true });
  }

  const query = menuQuery.trim().toLowerCase();
  const visibleDishes = menuCategories.flatMap((cat) => {
    if (!query && activeCategoryId && cat.id !== activeCategoryId) return [];
    return cat.items.filter(
      (item) =>
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.plu.toLowerCase().includes(query),
    );
  });

  const checkOpen = Boolean(activeTicketId || draft);
  const heading =
    ticketCaption && dayNo
      ? t("ticketHeading", { name: ticketCaption, no: dayNo })
      : ticketCaption;

  useEffect(() => {
    setDiscountInput(String(storedDiscount));
  }, [activeTicketId, storedDiscount]);

  const halls = useMemo(() => {
    const groups = new Map<string, { label: string; sort: number }>();
    let hasBlank = false;
    for (const table of tables) {
      if (!table.hall?.id) {
        hasBlank = true;
        continue;
      }
      if (!groups.has(table.hall.id)) {
        groups.set(table.hall.id, { label: table.hall.name, sort: table.hall.sortOrder ?? 0 });
      }
    }
    const named = [...groups.entries()]
      .map(([key, row]) => ({ key, label: row.label, sort: row.sort }))
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    return { named, hasBlank, multiple: named.length + (hasBlank ? 1 : 0) > 1 };
  }, [tables]);
  const activeHall =
    halls.multiple &&
    hallFilter != null &&
    (hallFilter === "" ? halls.hasBlank : halls.named.some((hall) => hall.key === hallFilter))
      ? hallFilter
      : null;
  const visibleTables =
    activeHall == null
      ? tables
      : tables.filter((table) => (activeHall === "" ? !table.hall?.id : table.hall?.id === activeHall));
  const occupiedIn = (hallId: string | null) =>
    tables.filter(
      (table) =>
        table.status === "OCCUPIED" &&
        (hallId == null || (hallId === "" ? !table.hall?.id : table.hall?.id === hallId)),
    ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      {outlets.length > 1 && (
        <div className={`${CARD_CLASS} mb-4 p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-[#7F8C8D]">
              {t("outletLabel")}
              <select
                value={selectedOutletId}
                onChange={(e) => void selectOutlet(e.target.value)}
                disabled={outletSaving || outlets.length === 0}
                className={`${INPUT_CLASS} mt-1 min-w-[10rem]`}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {hotelMode && (
        <div className={`${CARD_CLASS} mb-4 grid gap-3 p-4 sm:grid-cols-2`}>
          <div>
            <p className="mb-2 text-sm font-semibold text-[#34495E]">{t("walkInTitle")}</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={walkInLabel}
                onChange={(e) => setWalkInLabel(e.target.value)}
                placeholder={t("walkInPlaceholder")}
                className={`${INPUT_CLASS} min-w-[8rem] flex-1`}
              />
              <button
                type="button"
                className="rounded bg-[#27AE60] px-3 py-1.5 text-sm text-white"
                onClick={() => void openWalkIn()}
              >
                {t("walkInOpen")}
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-[#34495E]">{t("banquetTitle")}</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedBeoId}
                onChange={(e) => setSelectedBeoId(e.target.value)}
                className={`${INPUT_CLASS} min-w-[10rem] flex-1`}
                disabled={banquets.length === 0}
              >
                {banquets.length === 0 ? (
                  <option value="">{t("banquetNone")}</option>
                ) : (
                  banquets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.referenceNo ? `${b.referenceNo} · ` : ""}
                      {b.eventName} ({b.pax} pax)
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="rounded bg-[#8E44AD] px-3 py-1.5 text-sm text-white"
                disabled={!selectedBeoId}
                onClick={() => void openBanquetTicket()}
              >
                {t("banquetOpen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{tc("loading")}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:overflow-hidden">
          <PosShiftPanel />
          <div className="grid min-h-0 flex-1 items-stretch gap-3 lg:overflow-hidden lg:grid-cols-[16rem_minmax(0,1fr)_24rem]">
          <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {!hotelMode && (
              <button
                type="button"
                className="w-full shrink-0 rounded bg-[#27AE60] px-3 py-2 text-sm font-medium text-white"
                onClick={startTakeaway}
              >
                {t("takeaway")}
              </button>
            )}
            {halls.multiple ? (
              <div className="flex max-h-[4.5rem] shrink-0 flex-wrap gap-1 overflow-y-auto">
                {[
                  { key: null as string | null, label: t("allZones") },
                  ...(halls.hasBlank ? [{ key: "", label: t("zoneMain") }] : []),
                  ...halls.named,
                ].map((hall) => {
                  const selected = activeHall === hall.key;
                  const count = occupiedIn(hall.key);
                  const label = hall.label;
                  return (
                    <button
                      key={hall.key ?? "all"}
                      type="button"
                      onClick={() => setHallFilter(hall.key)}
                      title={label}
                      className={`inline-flex h-8 max-w-[7.25rem] items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${
                        selected ? "bg-[#2980B9] text-white" : "bg-white text-[#34495E] ring-1 ring-[#D5DADF]"
                      }`}
                    >
                      <span className="truncate">{label}</span>
                      {count > 0 ? (
                        <span
                          className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            selected ? "bg-white text-[#2980B9]" : "bg-[#2980B9] text-white"
                          }`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {!hotelMode && openChips.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {openChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => void focusTicket(chip.id, t("takeaway"))}
                        className={`${CARD_CLASS} flex h-24 w-full flex-col px-3 py-2 text-left ${
                          chip.id === activeTicketId ? "border-[#2980B9] bg-[#EAF3FB]" : ""
                        }`}
                      >
                        <span className="text-base font-semibold">
                          {t("takeaway")}
                          {chip.dayNo ? ` #${chip.dayNo}` : ""}
                        </span>
                        <span className="mt-auto flex items-end justify-between gap-2">
                          <span className="text-xs text-[#7F8C8D]">
                            {chip.openedAt ? bakuTimeLabel(chip.openedAt) : ""}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-[#2C3E50]">
                            {Number(chip.totalAzn).toFixed(2)} {tc("azn")}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
            )}
            <ColorLegend
              items={[
                { id: "free", label: t("statusFree"), swatchClassName: "bg-white" },
                { id: "occupied", label: t("statusOccupied"), swatchClassName: "bg-[#EBEDF0]" },
              ]}
            />
            <div className="grid gap-2">
              {tables.length === 0 && (
                <p className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("noTables")}</p>
              )}
              {tables.length > 0 && visibleTables.length === 0 && (
                <p className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("noTablesInZone")}</p>
              )}
              {visibleTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => selectTable(table)}
                  className={`${CARD_CLASS} flex h-24 w-full flex-col p-3 text-left transition hover:border-[#2980B9] ${
                    table.status === "OCCUPIED" ? "border-[#2980B9] bg-[#EAF3FB]" : ""
                  } ${draft?.kind === "table" && draft.tableId === table.id ? "border-[#2980B9]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-base font-semibold leading-5">{table.name}</span>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        table.status === "OCCUPIED"
                          ? "bg-[#2980B9] text-white"
                          : "bg-[#EBEDF0] text-[#34495E]"
                      }`}
                    >
                      {table.status === "OCCUPIED" ? t("statusOccupied") : t("statusFree")}
                    </span>
                  </div>
                  <span className="mt-auto flex items-end justify-between gap-2">
                    <span className="text-xs text-[#7F8C8D]">
                      {table.openedAt ? bakuTimeLabel(table.openedAt) : ""}
                    </span>
                    {table.status === "OCCUPIED" && table.openTotalAzn != null ? (
                      <span className="text-sm font-semibold tabular-nums text-[#2C3E50]">
                        {Number(table.openTotalAzn).toFixed(2)} {tc("azn")}
                      </span>
                    ) : (
                      <span />
                    )}
                  </span>
                </button>
              ))}
            </div>
            </div>
          </div>

          <div className={`${CARD_CLASS} grid min-h-0 gap-3 overflow-hidden p-3 lg:grid-cols-[12rem_minmax(0,1fr)]`}>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {menuCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`rounded-md px-3 py-2.5 text-left text-base font-semibold ${
                    !query && cat.id === activeCategoryId
                      ? "bg-[#2980B9] text-white"
                      : "bg-[#F4F6F7] text-[#2C3E50]"
                  }`}
                  onClick={() => {
                    setMenuQuery("");
                    setActiveCategoryId(cat.id);
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="flex min-h-0 flex-col">
            <input
              type="search"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder={t("menuSearch")}
              className={`${INPUT_CLASS} mb-3 w-full shrink-0`}
            />
            <div className="min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {visibleDishes.map((m) => (
                <div key={m.id} className="relative">
                <button
                  type="button"
                  onClick={() => void addDish(m)}
                  disabled={soldOutIds.has(m.id)}
                  className={`flex h-32 w-full flex-col items-center justify-center rounded-md border border-[#D5DADF] bg-white px-2 text-center ${
                    soldOutIds.has(m.id) ? "opacity-40" : "hover:border-[#2980B9]"
                  }`}
                >
                  <span className="line-clamp-2 text-lg font-semibold leading-6 text-[#2C3E50]">
                    {m.name}
                  </span>
                  <span className="mt-2 text-base font-bold tabular-nums text-[#1E8449]">
                    {Number(m.priceAzn).toFixed(2)} {tc("azn")}
                  </span>
                </button>
                {canSoldOut ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded p-1 text-[#7F8C8D] hover:text-[#C0392B]"
                    aria-label={soldOutIds.has(m.id) ? t("inStock") : t("soldOut")}
                    onClick={() => void toggleSoldOut(m)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                </div>
              ))}
            </div>
            </div>
            </div>
          </div>

          <div className={`${CARD_CLASS} flex min-h-0 flex-col overflow-hidden p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {t("ticketTitle")}
            </p>
            {lastPaid ? (
              <p className="mt-2 text-sm text-[#1E8449]">
                {t("paidBanner", {
                  no: lastPaid.dayNo ?? "—",
                  amount: lastPaid.amount.toFixed(2),
                  change:
                    lastPaid.change == null
                      ? ""
                      : t("changeDue", { amount: lastPaid.change.toFixed(2) }),
                })}
              </p>
            ) : null}
            {checkOpen ? (
              <>
                <p className="mt-1 text-base font-semibold">{heading || t("ticketTitle")}</p>
                <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
                  {ticketLines.length === 0 ? (
                    <p className="text-sm text-[#7F8C8D]">{t("ticketEmpty")}</p>
                  ) : (
                    <CheckLines
                      lines={ticketLines}
                      onQty={(line, qty) => void changeQty(line, qty)}
                      onRemove={(line) => void changeQty(line, 0)}
                      azn={tc("azn")}
                      labels={{
                        name: t("colName"),
                        qty: t("colQty"),
                        price: t("colPrice"),
                        sum: t("colSum"),
                        minus: t("qtyMinus"),
                        plus: t("qtyPlus"),
                        remove: t("qtyMinus"),
                      }}
                      discount={(() => {
                        const gross = ticketLines.reduce(
                          (sum, line) => sum + line.qty * Number(line.unitPriceAzn),
                          0,
                        );
                        const pct = Math.min(100, Math.max(0, Number(discountInput) || 0));
                        const net = Math.round(gross * (1 - pct / 100) * 100) / 100;
                        const amount = Math.round((gross - net) * 100) / 100;
                        return {
                          label: t("discountPercent"),
                          value: discountInput,
                          onChange: setDiscountInput,
                          onBlur: () => void persistDiscount(),
                          amountText: pct > 0 ? `−${amount.toFixed(2)}` : null,
                          netText: `${net.toFixed(2)} ${tc("azn")}`,
                        };
                      })()}
                      tender={
                        canPay
                          ? {
                              label: t("cashReceived"),
                              value: cashReceived,
                              onChange: setCashReceived,
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
                {canPay && activeTicketId && ticketLines.length > 0 && (ticketTotal ?? 0) > 0 && (
                  <div className="mt-3 shrink-0 space-y-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="rounded bg-[#27AE60] px-3 py-2 text-sm text-white"
                        onClick={() => void pay("CASH")}
                      >
                        {t("payCash")}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-[#2980B9] px-3 py-2 text-sm text-white"
                        onClick={() => void pay("CARD")}
                      >
                        {t("payCard")}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-[#1A5276] px-3 py-2 text-sm text-white"
                        onClick={() => void pay("TRANSFER")}
                      >
                        {t("payTransfer")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[#C0392B] px-3 py-2 text-sm text-[#C0392B]"
                        onClick={() => void cancelTicket()}
                      >
                        {t("cancelTicket")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-[#7F8C8D]">{t("openTableFirst")}</p>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
