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

function defaultLines(menuItems: MenuItem[]) {
  const defaultLine = menuItems[0];
  if (defaultLine) {
    return [
      {
        description: defaultLine.name,
        qty: 1,
        unitPriceAzn: Number(defaultLine.priceAzn),
        menuItemPlu: defaultLine.plu,
      },
    ];
  }
  return [{ description: "Table service", qty: 1, unitPriceAzn: 0 }];
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

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) ?? null;
  const outletCode = selectedOutlet?.code ?? "RESTAURANT";

  const load = useCallback(async () => {
    setLoading(true);
    const [tablesRes, menuRes, outletsRes, banquetsRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/menu?dailyOnly=true"),
      fetch("/api/outlets"),
      fetch("/api/banquets"),
    ]);
    const tablesData = await tablesRes.json();
    const menuData = await menuRes.json();
    const outletsData = await outletsRes.json();
    const banquetsData = await banquetsRes.json();

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

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{tc("loading")}</p>
      ) : (
        <>
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
