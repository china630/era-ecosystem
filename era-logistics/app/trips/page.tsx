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
  const [message, setMessage] = useState("");

  async function loadTrips() {
    const res = await fetch("/api/trips");
    setTrips(await res.json());
  }

  useEffect(() => {
    void loadTrips();
  }, []);

  async function completeTrip(id: string) {
    setMessage("");
    const res = await fetch(`/api/trips/${id}/complete`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setMessage(`Trip ${id.slice(0, 8)} completed`);
    await loadTrips();
  }

  return (
    <>
      <PageHeader
        title="ERA Logistics"
        subtitle="Trips — complete to dispatch event"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-3`}>
        {message && <p className="text-[13px]">{message}</p>}
        <ul className="space-y-2 text-[13px]">
          {trips.map((trip) => (
            <li key={trip.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {trip.vehicle.plate} — {Number(trip.freightAmount).toFixed(2)} AZN ({trip.status})
              </span>
              {trip.status !== "COMPLETED" && (
                <button
                  type="button"
                  className="text-[12px] text-[#2980B9] underline"
                  onClick={() => completeTrip(trip.id)}
                >
                  Complete
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
