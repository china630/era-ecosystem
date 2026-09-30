"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CLASS, PRIMARY_BTN_CLASS } from "@/lib/design-system";

type DayBoard = {
  date: string;
  openedToday: number;
  openNow: number;
  occupiedTables: number;
  revenueAzn: number;
  topDishes: { name: string; qty: number }[];
};

export default function HomeDashboard() {
  const t = useTranslations("home");
  const [kafe, setKafe] = useState(true);
  const [hasKds, setHasKds] = useState(false);
  const [board, setBoard] = useState<DayBoard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/edition")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const isKafe = d?.edition === "kafe" || d?.hotelMode === false;
        setKafe(Boolean(isKafe));
        setHasKds(
          !isKafe ||
            (Array.isArray(d?.activeModules) &&
              d.activeModules.includes("fnb_kitchen_kds")),
        );
      })
      .catch(() => undefined);
    void fetch("/api/dashboard/today")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setError(typeof data?.error === "string" ? data.error : t("loadFailed"));
          return;
        }
        setBoard(data as DayBoard);
      })
      .catch(() => setError(t("loadFailed")));
  }, [t]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#2C3E50]">
          {kafe ? t("titleKafe") : t("title")}
        </h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">
          {kafe ? t("subtitleKafe") : t("subtitlePlain")}
        </p>
      </div>

      {error ? <p className="text-sm text-[#C0392B]">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("openedToday")} value={board ? String(board.openedToday) : "—"} />
        <Stat label={t("openNow")} value={board ? String(board.openNow) : "—"} />
        <Stat label={t("occupiedTables")} value={board ? String(board.occupiedTables) : "—"} />
        <Stat
          label={t("revenueToday")}
          value={board ? `${board.revenueAzn.toFixed(2)} AZN` : "—"}
        />
      </div>

      <div className={`${CARD_CLASS} p-4`}>
        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("topDishes")}</h2>
        {board && board.topDishes.length > 0 ? (
          <ol className="space-y-1 text-sm">
            {board.topDishes.map((row) => (
              <li key={row.name} className="flex justify-between gap-3">
                <span>{row.name}</span>
                <span className="text-[#7F8C8D]">{row.qty}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#7F8C8D]">{t("topEmpty")}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/floor" className={PRIMARY_BTN_CLASS}>
          {t("openFloor")}
        </Link>
        <Link href="/orders" className={PRIMARY_BTN_CLASS}>
          {t("activeOrders")}
        </Link>
        {hasKds ? (
          <Link href="/kds" className={PRIMARY_BTN_CLASS}>
            {t("kitchenDisplay")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${CARD_CLASS} p-4`}>
      <p className="text-xs text-[#7F8C8D]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#2C3E50]">{value}</p>
    </div>
  );
}
