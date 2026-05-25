"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
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
        title="Day schedule"
        subtitle="K-05 — practitioner day grid (slots API stub)"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            Date
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            Practitioner code
            <input
              className="rounded border px-2 py-1"
              placeholder="optional"
              value={practitionerCode}
              onChange={(e) => setPractitionerCode(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">Loading slots…</p>
        ) : !data ? (
          <p className="text-[13px] text-red-600">Failed to load schedule.</p>
        ) : (
          <>
            <p className="text-[13px] text-[#7F8C8D]">
              {data.date}
              {data.practitionerCode ? ` · ${data.practitionerCode}` : " · all practitioners"}
            </p>
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
            <p className="text-[12px] text-[#7F8C8D]">
              Drag reschedule stub — use appointments API to move blocks (K3 MVP).
            </p>
          </>
        )}
      </div>
    </>
  );
}
