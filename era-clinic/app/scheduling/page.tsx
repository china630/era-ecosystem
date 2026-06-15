"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Slot = { time: string; available: boolean };

type SlotsResponse = {
  date: string;
  practitionerCode: string | null;
  slots: Slot[];
};

export default function SchedulingPage() {
  const t = useTranslations("scheduling");
  const tNav = useTranslations("nav");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [practitionerCode, setPractitionerCode] = useState("");
  const [practitioners, setPractitioners] = useState<Array<{ code: string; fullName: string }>>([]);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  function loadSlots() {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (practitionerCode) params.set("practitionerCode", practitionerCode);
    fetch(`/api/scheduling/slots?${params}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void fetch("/api/admin/practitioners")
      .then((r) => r.json())
      .then((d) => setPractitioners((d.data ?? d) as Array<{ code: string; fullName: string }>));
  }, []);

  useEffect(() => {
    loadSlots();
  }, [date, practitionerCode]);

  async function rescheduleTo(time: string) {
    if (!dragFrom) return;
    const apptRes = await fetch("/api/appointments");
    const appts = await apptRes.json();
    const list = Array.isArray(appts) ? appts : (appts.data ?? []);
    const match = list.find(
      (a: { scheduledAt: string }) =>
        new Date(a.scheduledAt).toISOString().slice(11, 16) === dragFrom,
    );
    if (!match) {
      setMsg(t("noAppointment"));
      return;
    }
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const res = await fetch(`/api/appointments/${match.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt }),
    });
    setMsg(res.ok ? t("rescheduled") : t("rescheduleFailed"));
    setDragFrom(null);
    loadSlots();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            {t("date")}
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            {t("practitionerCode")}
            <select
              className="rounded border px-2 py-1"
              value={practitionerCode}
              onChange={(e) => setPractitionerCode(e.target.value)}
            >
              <option value="">{t("allPractitioners")}</option>
              {practitioners.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.fullName} ({p.code})
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("loadingSlots")}</p>
        ) : !data ? (
          <p className="text-[13px] text-red-600">{t("loadFailed")}</p>
        ) : (
          <>
            <p className="text-[13px] text-[#7F8C8D]">
              {data.date}
              {data.practitionerCode
                ? ` · ${data.practitionerCode}`
                : ` · ${t("allPractitioners")}`}
            </p>
            <ColorLegend
              items={[
                { id: "available", label: t("available"), swatchClassName: "bg-green-50" },
                { id: "busy", label: t("unavailable"), swatchClassName: "bg-slate-100" },
              ]}
            />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {data.slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  draggable={slot.available}
                  onDragStart={() => setDragFrom(slot.time)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void rescheduleTo(slot.time)}
                  className={`rounded border px-2 py-3 text-center text-[12px] ${
                    dragFrom === slot.time
                      ? "border-blue-400 bg-blue-50"
                      : slot.available
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-slate-200 bg-slate-100 text-slate-500 line-through"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[#7F8C8D]">{t("dragHint")}</p>
            {msg && <p className="text-sm text-slate-600">{msg}</p>}
          </>
        )}
      </div>
    </>
  );
}
