"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

type Slot = {
  time: string;
  occupied: boolean;
  patientName?: string;
  procedureName?: string;
};

type ResourceRow = {
  code: string;
  name: string;
  slots: Slot[];
};

export default function SanatoriumResourcesPage() {
  const t = useTranslations("sanatoriumResources");
  const tNav = useTranslations("nav");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resources, setResources] = useState<ResourceRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/resources/calendar?date=${date}`);
    const data = await res.json();
    const payload = data.data ?? data;
    setResources(payload.resources ?? []);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/sanatorium" className={PRIMARY_BUTTON_CLASS}>
            {tNav("sanatorium")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <label className="text-sm">
          {t("date")}
          <input
            type="date"
            className="ml-2 rounded border px-2 py-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {resources.map((resource) => (
          <div key={resource.code}>
            <h3 className="mb-2 font-semibold">
              {resource.code} — {resource.name}
            </h3>
            <div className="flex flex-wrap gap-1">
              {resource.slots.map((slot) => (
                <div
                  key={slot.time}
                  title={
                    slot.occupied
                      ? `${slot.patientName ?? ""} ${slot.procedureName ?? ""}`
                      : t("free")
                  }
                  className={`h-6 w-8 rounded text-[9px] leading-6 text-center ${
                    slot.occupied ? "bg-sky-500 text-white" : "bg-[#ECF0F1]"
                  }`}
                >
                  {new Date(slot.time).getMinutes() || "·"}
                </div>
              ))}
            </div>
          </div>
        ))}
        {resources.length === 0 && <p className="text-sm text-slate-500">{t("empty")}</p>}
      </div>
    </>
  );
}
