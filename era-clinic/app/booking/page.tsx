"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { addBakuDays, bakuDateTimeDisplay, todayBakuYmd } from "@/lib/baku-day";

type AvailabilitySlot = {
  scheduledAt: string;
  practitionerCode: string;
  practitionerName: string;
  durationMinutes: number;
};

export default function BookingWidgetPage() {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dayYmd, setDayYmd] = useState(todayBakuYmd());
  const [practitionerCode] = useState("GP-01");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    const to = addBakuDays(dayYmd, 6);
    const params = new URLSearchParams({
      practitionerCode,
      from: dayYmd,
      to,
    });
    const res = await fetch(`/api/booking/availability?${params.toString()}`);
    setLoadingSlots(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), t("availabilityFailed"));
      setSlots([]);
      return;
    }
    const body = (await res.json()) as { slots: AvailabilitySlot[] };
    setSlots(body.slots ?? []);
    setSelectedAt(null);
  }, [dayYmd, practitionerCode, t]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const daySlots = useMemo(
    () =>
      slots.filter((s) => {
        try {
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Baku",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(s.scheduledAt)) === dayYmd;
        } catch {
          return false;
        }
      }),
    [slots, dayYmd],
  );

  async function book() {
    if (!selectedAt) {
      showApiError({ error: "Pick a slot" }, t("pickSlot"));
      return;
    }
    const ref = phone || `WEB-${Date.now()}`;
    const res = await fetch("/api/booking/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerRef: ref,
        customerName: name,
        customerPhone: phone,
        scheduledAt: selectedAt,
        practitionerCode,
      }),
    });
    if (res.ok) {
      showSuccess(t("success"));
      void loadSlots();
      return;
    }
    const err = await res.json().catch(() => ({}));
    if (err?.code === "SLOT_TAKEN") {
      showApiError(err, t("slotTaken"));
      void loadSlots();
      return;
    }
    showApiError(err, t("error"));
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} max-w-lg space-y-4 p-4`}>
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <DatePicker
          label={t("pickDay")}
          value={dayYmd}
          onChange={(v) => setDayYmd(v || todayBakuYmd())}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <section>
          <p className="mb-2 text-sm font-medium">{t("pickSlot")}</p>
          {loadingSlots ? (
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("loadingSlots")}</p>
          ) : daySlots.length === 0 ? (
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("noSlots")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {daySlots.map((slot) => {
                const active = selectedAt === slot.scheduledAt;
                return (
                  <li key={slot.scheduledAt}>
                    <button
                      type="button"
                      onClick={() => setSelectedAt(slot.scheduledAt)}
                      className={`w-full rounded border px-2 py-1.5 text-sm ${
                        active
                          ? "border-[#2980B9] bg-[#2980B9]/10 font-medium"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {bakuDateTimeDisplay(slot.scheduledAt)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {selectedAt ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
            {t("selected")}: {bakuDateTimeDisplay(selectedAt)}
          </p>
        ) : null}
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void book()}>
          {t("submit")}
        </button>
      </div>
    </>
  );
}