"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type FuelReport = {
  from: string | null;
  to: string | null;
  currency: string;
  totals: { liters: number; cost: number; tripCount: number };
  byVehicle: {
    vehicleId: string;
    plate: string;
    liters: number;
    cost: number;
    tripCount: number;
  }[];
  trips: {
    id: string;
    routeCode?: string | null;
    status: string;
    plate: string;
    liters: number | null;
    cost: number | null;
    createdAt: string;
  }[];
};

function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function FuelReportPage() {
  const t = useTranslations("fuelReport");
  const tc = useTranslations("common");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [report, setReport] = useState<FuelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ from, to });
    fetch(`/api/reports/fuel?${q}`)
      .then((res) => res.json())
      .then((data) => setReport(data))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
            {t("trips")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap items-end gap-4 text-[13px]">
          <label>
            {t("from")}
            <input
              type="date"
              className="mt-1 block rounded border px-2 py-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("to")}
            <input
              type="date"
              className="mt-1 block rounded border px-2 py-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : report ? (
          <>
            <p className="text-[13px]">
              {t("total")}: <strong>{report.totals.liters.toFixed(2)} L</strong>,{" "}
              <strong>{report.totals.cost.toFixed(2)} {report.currency}</strong> (
              {t("tripsCount", { count: report.totals.tripCount })})
            </p>

            {report.byVehicle.length > 0 && (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4">{t("plate")}</th>
                    <th className="py-2 pr-4">{t("trips")}</th>
                    <th className="py-2 pr-4">L</th>
                    <th className="py-2">{report.currency}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byVehicle.map((row) => (
                    <tr key={row.vehicleId} className="border-b">
                      <td className="py-2 pr-4">{row.plate}</td>
                      <td className="py-2 pr-4">{row.tripCount}</td>
                      <td className="py-2 pr-4">{row.liters.toFixed(2)}</td>
                      <td className="py-2">{row.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {report.trips.length > 0 ? (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4">{t("trip")}</th>
                    <th className="py-2 pr-4">{t("plate")}</th>
                    <th className="py-2 pr-4">L</th>
                    <th className="py-2">{report.currency}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trips.map((trip) => (
                    <tr key={trip.id} className="border-b">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/trips/${trip.id}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {trip.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{trip.plate}</td>
                      <td className="py-2 pr-4">
                        {trip.liters != null ? trip.liters.toFixed(2) : "—"}
                      </td>
                      <td className="py-2">
                        {trip.cost != null ? trip.cost.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
