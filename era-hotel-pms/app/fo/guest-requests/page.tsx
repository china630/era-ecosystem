"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, showApiError } from "@era/satellite-kit/ui";

type Row = {
  id: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  packageNote: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  reservationId: string | null;
  resNo: string | null;
};

export default function GuestRequestsPage() {
  const t = useTranslations("guestAppStaff");
  const [items, setItems] = useState<Row[]>([]);
  const [resId, setResId] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/guest-app/staff/booking-requests");
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    const data = (await res.json()) as { items: Row[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(id: string, cancel: boolean) {
    const res = await fetch(`/api/guest-app/staff/booking-requests/${id}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cancel,
        reservationId: cancel ? null : resId[id] || null,
      }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded border bg-white p-3 text-sm">
            <div className="font-medium">
              {row.checkIn} → {row.checkOut} · {row.adults}+{row.children} · {row.status}
            </div>
            {row.contactName || row.contactPhone ? (
              <div className="text-[#7F8C8D]">
                {row.contactName} {row.contactPhone}
              </div>
            ) : null}
            {row.packageNote ? <div>{row.packageNote}</div> : null}
            {row.resNo ? <div>{t("linked")}: {row.resNo}</div> : null}
            {row.status === "requested" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="rounded border px-2 py-1 font-mono text-xs"
                  placeholder={t("reservationId")}
                  value={resId[row.id] ?? ""}
                  onChange={(e) => setResId((m) => ({ ...m, [row.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void answer(row.id, false)}
                >
                  {t("link")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void answer(row.id, true)}
                >
                  {t("cancel")}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("empty")}</p> : null}
    </div>
  );
}
