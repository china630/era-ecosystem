"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Trip = {
  id: string;
  status: string;
  freightAmount: string | number;
  routeCode?: string | null;
  vehicle: { plate: string };
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    fetch("/api/trips")
      .then((res) => res.json())
      .then((data) => setTrips(Array.isArray(data) ? data : []));
  }, []);

  return (
    <>
      <PageHeader
        title="ERA Logistics"
        subtitle="Trips — open detail for POD, fuel, workflow"
        actions={
          <>
            <Link
              href="/reports/fuel"
              className="mr-2 text-[13px] text-[#2980B9] hover:underline"
            >
              Fuel report
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              Home
            </Link>
          </>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-3`}>
        {trips.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">No trips yet.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between rounded border p-2 hover:bg-[#F8F9FA]"
                >
                  <span>
                    {trip.vehicle.plate}
                    {trip.routeCode ? ` · ${trip.routeCode}` : ""} —{" "}
                    {Number(trip.freightAmount).toFixed(2)} AZN
                  </span>
                  <span className="text-[12px] text-[#7F8C8D]">{trip.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
