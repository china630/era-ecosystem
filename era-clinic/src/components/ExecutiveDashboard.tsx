"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, FieldSelect, TEXT_DANGER_CLASS, TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";

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

export function ExecutiveDashboard({
  date,
  refreshKey = 0,
}: {
  date: string;
  refreshKey?: number;
}) {
  const t = useTranslations("executive");
  const tc = useTranslations("common");
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
  }, [load, refreshKey]);

  if (loading && !summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  if (error) {
    return <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{error}</p>;
  }

  if (!summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-4">
      <FieldSelect
        label={t("filterPractitioner")}
        preset="selectWide"
        value={practitionerId}
        onChange={(e) => setPractitionerId(e.target.value)}
      >
        <option value="">{tc("all")}</option>
        {practitioners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </FieldSelect>
      <dl className={`${CARD_CONTAINER_CLASS} grid gap-4 p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="rounded border p-4">
          <dt className={TEXT_MUTED_CLASS}>{t("visitsToday")}</dt>
          <dd className="text-2xl font-semibold">{summary.visitsToday}</dd>
        </div>
        <div className="rounded border p-4">
          <dt className={TEXT_MUTED_CLASS}>{t("labRevenueToday")}</dt>
          <dd className="text-2xl font-semibold">{summary.labRevenueToday.toFixed(2)} AZN</dd>
        </div>
        <div className="rounded border p-4">
          <dt className={TEXT_MUTED_CLASS}>{t("openLabOrders")}</dt>
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
          <dt className={TEXT_MUTED_CLASS}>{t("capacityTitle")}</dt>
          <dd className="text-2xl font-semibold">~{summary.capacity.guestEquivalent} guests</dd>
          <dd className={`text-xs ${TEXT_MUTED_CLASS}`}>
            {summary.capacity.scheduledSlots} slots · risk {summary.capacity.riskLevel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
