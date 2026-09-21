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
};

type MenuItem = {
  id: string;
  plu: string;
  name: string;
  priceAzn: string | number;
  imageUrl?: string | null;
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

function defaultLines(_menuItems: MenuItem[]) {
  return [];
}

export default function FloorPanel() {
  const t = useTranslations("floor");
  const tc = useTranslations("common");

  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [banquets, setBanquets] = useState<BanquetEvent[]>([]);
  const [selectedBeoId, setSelectedBeoId] = useState("");
  const [walkInLabel, setWalkInLabel] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [outletSaving, setOutletSaving] = useState(false);
  const [hotelMode, setHotelMode] = useState(true);
  const [soldOutIds, setSoldOutIds] = useState<Set<string>>(new Set());
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;
  const outletCode = selectedOutlet?.code ?? "RESTAURANT";

  const load = useCallback(async () => {
    setLoading(true);
    const [tablesRes, menuRes, outletsRes, editionRes, soldRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/menu?dailyOnly=true"),
      fetch("/api/outlets"),
      fetch("/api/edition"),
      fetch("/api/menu/sold-out"),
    ]);
    const tablesData = await tablesRes.json();
    const menuData = await menuRes.json();
    const outletsData = await outletsRes.json();
    const editionData = await editionRes.json().catch(() => ({}));
    const soldData = await soldRes.json().catch(() => ({ soldOut: [] }));
    setHotelMode(editionData?.hotelMode !== false && editionData?.edition !== "kafe");
    setSoldOutIds(
      new Set(
        (Array.isArray(soldData.soldOut) ? soldData.soldOut : []).map(
          (r: { menuItemId: string }) => r.menuItemId,
        ),
      ),
    );
    let banquetsData: BanquetEvent[] = [];
    if (editionData?.hotelMode !== false && editionData?.edition !== "kafe") {
      const banquetsRes = await fetch("/api/banquets");
      banquetsData = await banquetsRes.json();
    }

    setTables(Array.isArray(tablesData) ? tablesData : []);
    const items = Array.isArray(menuData)
      ? menuData.flatMap((cat: { items?: MenuItem[] }) => cat.items ?? [])
      : [];
    setMenuItems(items);

    const outletList = Array.isArray(outletsData.outlets) ? outletsData.outlets : [];
    setOutlets(outletList);
    const sel =
      outletsData.selectedOutletId ??
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

    setLoading(false);
  }, []);

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
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? tc("failed"));
      return;
    }
    setMessage(t(successKey, { total: Number(data.totalAzn).toFixed(2), ...vars }));
    if (typeof data.id === "string") setActiveTicketId(data.id);
    await load();
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
  }

  async function toggleSoldOut(item: MenuItem) {
    const next = !soldOutIds.has(item.id);
    await fetch("/api/menu/sold-out", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: item.id, soldOut: next }),
    });
    await load();
  }

  async function openTicket(table: Table) {
    await createTicket(
      {
        outletCode,
        tableId: table.id,
        covers: 2,
        lines: defaultLines(menuItems),
      },
      "ticketOpened",
      { table: table.code },
    );
  }

  async function openWalkIn() {
    await createTicket(
      {
        outletCode,
        serviceChannel: "WALK_IN",
        walkInLabel: walkInLabel.trim() || t("walkInDefaultLabel"),
        lines: defaultLines(menuItems),
      },
      "walkInOpened",
    );
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
        lines: defaultLines(menuItems),
      },
      "banquetOpened",
      { name: beo?.eventName ?? selectedBeoId.slice(0, 8) },
    );
  }

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
              {outlets.length === 0 && <option value="">{tc("loading")}</option>}
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
          {menuItems.length > 0 && (
            <div className={`${CARD_CLASS} mb-3 p-3`}>
              <p className="mb-2 text-xs text-[#7F8C8D]">{t("menuStrip")}</p>
              <div className="flex gap-2 overflow-x-auto">
                {menuItems.slice(0, 16).map((m) => (
                    <div key={m.id} className="w-24 shrink-0 text-center text-[10px] text-[#34495E]">
                    <button
                      type="button"
                      onClick={() => void addDish(m)}
                      disabled={soldOutIds.has(m.id)}
                      className={`w-full ${soldOutIds.has(m.id) ? "opacity-40" : ""}`}
                    >
                      {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt={m.name}
                        className="mb-1 h-14 w-20 rounded object-cover"
                      />
                      ) : (
                        <div className="mb-1 h-14 w-20 rounded bg-[#EBEDF0]" />
                      )}
                      {m.name}
                    </button>
                    <button
                      type="button"
                      className="mt-1 rounded bg-[#EBEDF0] px-1 py-0.5"
                      onClick={() => void toggleSoldOut(m)}
                    >
                      {soldOutIds.has(m.id) ? "var" : "bitdi"}
                    </button>
                    </div>
                ))}
              </div>
            </div>
          )}
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
                disabled={table.status === "OCCUPIED"}
                className={`${CARD_CLASS} p-4 text-left transition hover:border-[#2980B9] disabled:opacity-60`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{table.code}</span>
                  <span className="rounded-lg bg-[#EBEDF0] px-2 py-0.5 text-xs">
                    {table.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#7F8C8D]">{table.name}</p>
                <p className="mt-2 text-xs text-[#2980B9]">
                  {table.status === "FREE" ? t("tapOpen") : t("occupiedHint")}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
