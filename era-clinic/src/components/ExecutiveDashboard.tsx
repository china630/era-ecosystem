"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, MODAL_INPUT_CLASS } from "@era/satellite-kit/ui";

type Summary = {
  date: string;
  visitsToday: number;
  labRevenueToday: number;
  openLabOrders: number;
  capacity: {
    guestEquivalent: number;
    scheduledSlots: number;
    riskLevel: string;
  };
};

type Practitioner = { id: string; code: string; fullName: string };

export function ExecutiveDashboard() {
  const t = useTranslations("executive");
  const tc = useTranslations("common");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [practitionerId, setPractitionerId] = useState("");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/admin/practitioners")
      .then((r) => r.json())
      .then((d) => setPractitioners((d.data ?? d) as Practitioner[]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date });
    if (practitionerId) params.set("practitionerId", practitionerId);
    const res = await fetch(`/api/executive/summary?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("loadFailed"));
      setSummary(null);
    } else {
      setSummary((data.data ?? data) as Summary);
    }
    setLoading(false);
  }, [date, practitionerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !summary) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>;
  }

  if (error) {
    return <p className="text-[13px] text-red-600">{error}</p>;
  }

  if (!summary) {
    return <p className="text-[13px] text-[#7F8C8D]">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-[13px]">
          {t("filterDate")}
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          {t("filterPractitioner")}
          <select
            className={MODAL_INPUT_CLASS}
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
          >
            <option value="">{tc("all")}</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className={`${CARD_CONTAINER_CLASS} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 text-[13px]`}>
        <div className="rounded border p-4">
          <dt className="text-[#7F8C8D]">{t("visitsToday")}</dt>
          <dd className="text-2xl font-semibold">{summary.visitsToday}</dd>
        </div>
        <div className="rounded border p-4">
          <dt className="text-[#7F8C8D]">{t("labRevenueToday")}</dt>
          <dd className="text-2xl font-semibold">{summary.labRevenueToday.toFixed(2)} AZN</dd>
        </div>
        <div className="rounded border p-4">
          <dt className="text-[#7F8C8D]">{t("openLabOrders")}</dt>
          <dd className="text-2xl font-semibold">{summary.openLabOrders}</dd>
        </div>
        <div
          className={`rounded border p-4 ${
            summary.capacity.riskLevel === "critical"
              ? "border-red-400 bg-red-50"
              : summary.capacity.riskLevel === "warning"
                ? "border-amber-400 bg-amber-50"
                : ""
          }`}
        >
          <dt className="text-[#7F8C8D]">{t("capacityTitle")}</dt>
          <dd className="text-2xl font-semibold">~{summary.capacity.guestEquivalent} guests</dd>
          <dd className="text-xs text-[#7F8C8D]">
            {summary.capacity.scheduledSlots} slots · risk {summary.capacity.riskLevel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
