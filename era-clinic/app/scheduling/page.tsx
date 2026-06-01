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
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [practitionerCode, setPractitionerCode] = useState("");
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (practitionerCode) params.set("practitionerCode", practitionerCode);
    fetch(`/api/scheduling/slots?${params}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [date, practitionerCode]);

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
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
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
            <input
              className="rounded border px-2 py-1"
              placeholder={t("optional")}
              value={practitionerCode}
              onChange={(e) => setPractitionerCode(e.target.value)}
            />
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
                { id: "available", label: "Available", swatchClassName: "bg-green-50" },
                { id: "busy", label: "Unavailable", swatchClassName: "bg-slate-100" },
              ]}
            />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {data.slots.map((slot) => (
                <div
                  key={slot.time}
                  className={`rounded border px-2 py-3 text-center text-[12px] ${
                    slot.available
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-slate-100 text-slate-500 line-through"
                  }`}
                >
                  {slot.time}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[#7F8C8D]">{t("rescheduleStub")}</p>
          </>
        )}
      </div>
    </>
  );
}
