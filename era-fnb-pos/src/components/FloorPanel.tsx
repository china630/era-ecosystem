"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ColorLegend } from "@era/satellite-kit/ui";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";

type Table = {
  id: string;
  code: string;
  name: string;
  status: string;
  currentTicketId?: string | null;
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

function defaultLines() {
  return [];
}

export default function FloorPanel() {
  const t = useTranslations("floor");
  const tc = useTranslations("common");

  const [tables, setTables] = useState<Table[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [ticketLines, setTicketLines] = useState<TicketLineView[]>([]);
  const [ticketTotal, setTicketTotal] = useState<number | null>(null);
  const [ticketCaption, setTicketCaption] = useState("");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [banquets, setBanquets] = useState<BanquetEvent[]>([]);
  const [selectedBeoId, setSelectedBeoId] = useState("");
  const [walkInLabel, setWalkInLabel] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [outletSaving, setOutletSaving] = useState(false);
  const [hotelMode, setHotelMode] = useState(false);
  const [soldOutIds, setSoldOutIds] = useState<Set<string>>(new Set());
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;
  const outletCode = selectedOutlet?.code ?? "";

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [tablesRes, menuRes, outletsRes, editionRes, soldRes] = await Promise.all([
        fetch("/api/tables"),
        fetch("/api/menu"),
        fetch("/api/outlets"),
        fetch("/api/edition"),
        fetch("/api/menu/sold-out"),
      ]);
      const tablesData = await tablesRes.json().catch(() => null);
      const menuData = await menuRes.json().catch(() => null);
      const outletsData = await outletsRes.json().catch(() => ({}));
      const editionData = editionRes.ok
        ? await editionRes.json().catch(() => ({}))
        : {};
      const soldData = await soldRes.json().catch(() => ({ soldOut: [] }));
      const kafe =
        String(editionData?.edition ?? "").toLowerCase() === "kafe" ||
        editionData?.hotelMode === false;
      setHotelMode(!kafe);
      if (!tablesRes.ok) {
        setMessage(
          typeof tablesData?.error === "string" ? tablesData.error : tc("failed"),
        );
      }
      setSoldOutIds(
        new Set(
          (Array.isArray(soldData.soldOut) ? soldData.soldOut : []).map(
            (r: { menuItemId: string }) => r.menuItemId,
          ),
        ),
      );
      let banquetsData: BanquetEvent[] = [];
      if (!kafe) {
        const banquetsRes = await fetch("/api/banquets");
        banquetsData = await banquetsRes.json().catch(() => []);
      }

      setTables(Array.isArray(tablesData) ? tablesData : []);
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
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tc("failed"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectOutlet(outletId: string) {
    setSelectedOutletId(outletId);
    setOutletSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/outlets/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? tc("failed"));
        return;
      }
      setMessage(t("outletSelected", { code: data.code ?? outletCode }));
    } finally {
      setOutletSaving(false);
    }
  }

  async function createTicket(body: Record<string, unknown>, successKey: string, vars?: Record<string, string | number>) {
    setMessage("");
    const payload = { ...body };
    if (typeof payload.outletCode === "string" && !payload.outletCode.trim()) {
      delete payload.outletCode;
    }
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? tc("failed"));
      return;
    }
    setMessage(t(successKey, { total: Number(data.totalAzn).toFixed(2), ...vars }));
    if (typeof data.id === "string") {
      setActiveTicketId(data.id);
      setTicketLines(Array.isArray(data.lines) ? data.lines : []);
      setTicketTotal(Number(data.totalAzn) || 0);
    }
    await load({ silent: true });
  }

  async function addDish(item: MenuItem) {
    if (soldOutIds.has(item.id)) {
      setMessage(t("soldOut"));
      return;
    }
    if (!activeTicketId) {
      setMessage(t("openTableFirst"));
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
      setMessage(data.error ?? tc("failed"));
      return;
    }
    setMessage(t("dishAdded", { name: item.name }));
    if (activeTicketId) await focusTicket(activeTicketId);
  }

  async function focusTicket(id: string, caption?: string) {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setMessage(data?.error ?? tc("failed"));
      return;
    }
    setActiveTicketId(id);
    const lines = Array.isArray(data.lines) ? data.lines : [];
    setTicketLines(
      lines.filter(
        (line: { kitchenStatus?: string }) => line.kitchenStatus !== "VOID",
      ),
    );
    setTicketTotal(Number(data.totalAzn) || 0);
    const tableCode = data.table?.code as string | undefined;
    setTicketCaption(caption || tableCode || data.walkInLabel || id.slice(0, 6));
  }

  async function toggleSoldOut(item: MenuItem) {
    const next = !soldOutIds.has(item.id);
    await fetch("/api/menu/sold-out", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: item.id, soldOut: next }),
    });
    await load({ silent: true });
  }

  async function openTicket(table: Table) {
    if (table.status === "OCCUPIED") {
      if (table.currentTicketId) {
        await focusTicket(table.currentTicketId, table.code);
        return;
      }
      const res = await fetch("/api/tickets");
      const data = await res.json().catch(() => null);
      const found = Array.isArray(data)
        ? data.find(
            (ticket: { id?: string; table?: { id?: string } | null }) =>
              ticket.table?.id === table.id,
          )
        : null;
      if (found?.id) {
        await focusTicket(found.id, table.code);
        return;
      }
      setMessage(t("occupiedHint"));
      return;
    }
    await createTicket(
      {
        outletCode,
        tableId: table.id,
        covers: 2,
        lines: defaultLines(),
      },
      "ticketOpened",
      { table: table.code },
    );
    setTicketCaption(table.code);
  }

  async function openWalkIn() {
    await createTicket(
      {
        outletCode,
        serviceChannel: "WALK_IN",
        walkInLabel: walkInLabel.trim() || t("walkInDefaultLabel"),
        lines: defaultLines(),
      },
      "walkInOpened",
    );
    setTicketCaption(walkInLabel.trim() || t("walkInDefaultLabel"));
  }

  async function openBanquetTicket() {
    if (!selectedBeoId) {
      setMessage(t("banquetSelectRequired"));
      return;
    }
    const beo = banquets.find((b) => b.id === selectedBeoId);
    await createTicket(
      {
        outletCode: "BANQUET",
        beoId: selectedBeoId,
        guestName: beo?.eventName,
        covers: beo?.pax ?? 1,
        lines: defaultLines(),
      },
      "banquetOpened",
      { name: beo?.eventName ?? selectedBeoId.slice(0, 8) },
    );
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

  return (
    <>
      {message && <p className="mb-3 text-sm">{message}</p>}

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
              {outlets.length === 0 && (
                <option value="">{loading ? tc("loading") : t("outletEmpty")}</option>
              )}
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {o.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-[#7F8C8D]">{t("outletHint")}</p>
        </div>
      </div>

      <div className={`${CARD_CLASS} mb-4 grid gap-3 p-4 sm:grid-cols-2`}>
        <div>
          <p className="mb-2 text-sm font-semibold text-[#34495E]">
            {hotelMode ? t("walkInTitle") : t("counterTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={walkInLabel}
              onChange={(e) => setWalkInLabel(e.target.value)}
              placeholder={hotelMode ? t("walkInPlaceholder") : t("counterPlaceholder")}
              className={`${INPUT_CLASS} min-w-[8rem] flex-1`}
            />
            <button
              type="button"
              className="rounded bg-[#27AE60] px-3 py-1.5 text-sm text-white"
              onClick={() => void openWalkIn()}
            >
              {hotelMode ? t("walkInOpen") : t("counterOpen")}
            </button>
          </div>
        </div>
        {hotelMode ? (
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
        ) : (
          <div>
            <p className="mb-2 text-sm font-semibold text-[#34495E]">{t("stopListTitle")}</p>
            <p className="text-xs text-[#7F8C8D]">{t("stopListHint")}</p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{tc("loading")}</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 lg:grid-cols-[220px_1fr]">
            <div className={`${CARD_CLASS} p-3`}>
              <p className="mb-2 text-xs font-semibold text-[#34495E]">{t("ticketTitle")}</p>
              {activeTicketId ? (
                <>
                  <p className="mb-2 text-sm font-medium">{ticketCaption}</p>
                  <ul className="mb-2 space-y-1 text-sm">
                    {ticketLines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-2">
                        <span>
                          {line.qty}× {line.description}
                        </span>
                      </li>
                    ))}
                    {ticketLines.length === 0 ? (
                      <li className="text-[#7F8C8D]">{t("ticketEmpty")}</li>
                    ) : null}
                  </ul>
                  <p className="text-sm font-semibold">
                    {(ticketTotal ?? 0).toFixed(2)} AZN
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#7F8C8D]">{t("openTableFirst")}</p>
              )}
            </div>
            <div className={`${CARD_CLASS} p-3`}>
              <input
                type="search"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder={t("menuSearch")}
                className={`${INPUT_CLASS} mb-2 w-full`}
              />
              <div className="mb-2 flex gap-1 overflow-x-auto">
                {menuCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`shrink-0 rounded px-2 py-1 text-xs ${
                      !query && cat.id === activeCategoryId
                        ? "bg-[#2980B9] text-white"
                        : "bg-[#EBEDF0] text-[#34495E]"
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {visibleDishes.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded border border-[#D5DADF] p-2 text-left text-sm ${
                      soldOutIds.has(m.id) ? "opacity-40" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void addDish(m)}
                      disabled={soldOutIds.has(m.id)}
                      className="w-full text-left"
                    >
                      <span className="block font-medium">{m.name}</span>
                      <span className="text-xs text-[#7F8C8D]">
                        {Number(m.priceAzn).toFixed(2)} AZN
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mt-1 text-[10px] text-[#2980B9]"
                      onClick={() => void toggleSoldOut(m)}
                    >
                      {soldOutIds.has(m.id) ? "var" : "bitdi"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ColorLegend
            className="mb-3"
            items={[
              { id: "free", label: t("statusFree"), swatchClassName: "bg-white" },
              { id: "occupied", label: t("statusOccupied"), swatchClassName: "bg-[#EBEDF0]" },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tables.length === 0 && (
              <p className={`${CARD_CLASS} col-span-full p-4 text-sm text-[#7F8C8D]`}>
                {t("noTables")}
              </p>
            )}
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => void openTicket(table)}
                className={`${CARD_CLASS} p-4 text-left transition hover:border-[#2980B9] ${
                  table.status === "OCCUPIED" ? "bg-[#F4F6F7]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{table.code}</span>
                  <span className="rounded-lg bg-[#EBEDF0] px-2 py-0.5 text-xs">
                    {table.status === "OCCUPIED" ? t("statusOccupied") : t("statusFree")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#7F8C8D]">{table.name}</p>
                <p className="mt-2 text-xs text-[#2980B9]">
                  {table.status === "FREE" ? t("tapOpen") : t("tapResume")}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
