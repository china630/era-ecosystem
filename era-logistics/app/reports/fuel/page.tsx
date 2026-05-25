"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        title="Fuel report"
        subtitle="Fleet rollup by vehicle (L-05)"
        actions={
          <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
            Trips
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap items-end gap-4 text-[13px]">
          <label>
            From
            <input
              type="date"
              className="mt-1 block rounded border px-2 py-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              className="mt-1 block rounded border px-2 py-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
        ) : report ? (
          <>
            <p className="text-[13px]">
              Total: <strong>{report.totals.liters.toFixed(2)} L</strong>,{" "}
              <strong>{report.totals.cost.toFixed(2)} {report.currency}</strong> (
              {report.totals.tripCount} trips)
            </p>

            {report.byVehicle.length > 0 && (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4">Plate</th>
                    <th className="py-2 pr-4">Trips</th>
                    <th className="py-2 pr-4">Liters</th>
                    <th className="py-2">Cost</th>
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
                    <th className="py-2 pr-4">Trip</th>
                    <th className="py-2 pr-4">Plate</th>
                    <th className="py-2 pr-4">Liters</th>
                    <th className="py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trips.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/trips/${t.id}`}
                          className="text-[#2980B9] hover:underline"
                        >
                          {t.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{t.plate}</td>
                      <td className="py-2 pr-4">
                        {t.liters != null ? t.liters.toFixed(2) : "—"}
                      </td>
                      <td className="py-2">
                        {t.cost != null ? t.cost.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-[#7F8C8D]">No fuel data in range.</p>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
