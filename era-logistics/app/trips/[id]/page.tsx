"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Trip = {
  id: string;
  status: string;
  routeCode?: string | null;
  freightAmount: string | number;
  startedAt?: string | null;
  completedAt?: string | null;
  podRecipient?: string | null;
  podNotes?: string | null;
  podCapturedAt?: string | null;
  fuelLiters?: string | number | null;
  fuelCost?: string | number | null;
  vehicle: { plate: string; model?: string | null };
};

const STATUS_STEPS = ["PLANNED", "IN_TRANSIT", "DELIVERED", "COMPLETED"] as const;

export default function TripDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [trip, setTrip] = useState<Trip | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [podRecipient, setPodRecipient] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelCost, setFuelCost] = useState("");

  const loadTrip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/trips/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Trip not found");
      setTrip(null);
      setLoading(false);
      return;
    }
    setTrip(data);
    setPodRecipient(data.podRecipient ?? "");
    setPodNotes(data.podNotes ?? "");
    setFuelLiters(data.fuelLiters != null ? String(data.fuelLiters) : "");
    setFuelCost(data.fuelCost != null ? String(data.fuelCost) : "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  async function advanceStatus(next: "IN_TRANSIT" | "DELIVERED") {
    setMessage("");
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Status update failed");
      return;
    }
    setTrip(data);
    setMessage(`Status → ${data.status}`);
  }

  async function savePod(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch(`/api/trips/${id}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: podRecipient, notes: podNotes || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "POD save failed");
      return;
    }
    setTrip(data);
    setMessage("POD saved");
  }

  async function saveFuel(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const liters = parseFloat(fuelLiters);
    const cost = parseFloat(fuelCost);
    if (!Number.isFinite(liters) || liters <= 0 || !Number.isFinite(cost) || cost < 0) {
      setMessage("Enter valid liters and cost");
      return;
    }
    const res = await fetch(`/api/trips/${id}/fuel-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liters, cost }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Fuel report failed");
      return;
    }
    await loadTrip();
    setMessage(`Fuel recorded: ${data.liters} L, ${data.cost} AZN`);
  }

  async function completeTrip() {
    setMessage("");
    if (!trip?.podCapturedAt) {
      const strict = process.env.NEXT_PUBLIC_STRICT_POD === "true";
      const warn =
        "No POD captured yet. Save POD before completing, or proceed anyway.";
      if (strict) {
        setMessage(warn);
        return;
      }
      if (!window.confirm(warn)) return;
    }
    const res = await fetch(`/api/trips/${id}/complete`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Complete failed");
      return;
    }
    setTrip(data);
    setMessage("Trip completed — event dispatched");
  }

  if (loading) {
    return (
      <p className={`${CARD_CONTAINER_CLASS} p-6 text-[13px] text-[#7F8C8D]`}>Loading…</p>
    );
  }

  if (!trip) {
    return (
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-3`}>
        <p className="text-[13px]">{message || "Trip not found"}</p>
        <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
          Back to trips
        </Link>
      </div>
    );
  }

  const stepIndex = STATUS_STEPS.indexOf(trip.status as (typeof STATUS_STEPS)[number]);

  return (
    <>
      <PageHeader
        title={`Trip ${trip.id.slice(0, 8)}`}
        subtitle={`${trip.vehicle.plate}${trip.routeCode ? ` · ${trip.routeCode}` : ""}`}
        actions={
          <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
            All trips
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {message && <p className="text-[13px]">{message}</p>}

        <section className="space-y-2 text-[13px]">
          <h2 className="font-semibold">Overview</h2>
          <p>
            Vehicle: <strong>{trip.vehicle.plate}</strong>
            {trip.vehicle.model ? ` (${trip.vehicle.model})` : ""}
          </p>
          <p>Freight: {Number(trip.freightAmount).toFixed(2)} AZN</p>
          <p>Status: <strong>{trip.status}</strong></p>
          <ol className="flex flex-wrap gap-2">
            {STATUS_STEPS.map((s, i) => (
              <li
                key={s}
                className={`rounded px-2 py-0.5 text-[12px] ${
                  i <= stepIndex ? "bg-[#2980B9] text-white" : "bg-[#ECF0F1] text-[#7F8C8D]"
                }`}
              >
                {s}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2 text-[13px]">
          <h2 className="font-semibold">Status actions</h2>
          <div className="flex flex-wrap gap-2">
            {trip.status === "PLANNED" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => advanceStatus("IN_TRANSIT")}
              >
                Start trip
              </button>
            )}
            {trip.status === "IN_TRANSIT" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => advanceStatus("DELIVERED")}
              >
                Mark delivered
              </button>
            )}
            {trip.status !== "COMPLETED" && trip.status !== "CANCELLED" && (
              <button
                type="button"
                className="rounded border border-[#2980B9] px-3 py-1 text-[12px] text-[#2980B9]"
                onClick={() => void completeTrip()}
              >
                Complete trip
              </button>
            )}
          </div>
        </section>

        <form onSubmit={savePod} className="space-y-3 text-[13px] border-t pt-4">
          <h2 className="font-semibold">POD (L-04)</h2>
          <label className="block">
            Recipient *
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={podRecipient}
              onChange={(e) => setPodRecipient(e.target.value)}
              required
            />
          </label>
          <label className="block">
            Notes
            <textarea
              className="mt-1 w-full rounded border px-2 py-1"
              rows={2}
              value={podNotes}
              onChange={(e) => setPodNotes(e.target.value)}
            />
          </label>
          {trip.podCapturedAt && (
            <p className="text-[12px] text-[#7F8C8D]">
              Captured: {new Date(trip.podCapturedAt).toLocaleString()}
            </p>
          )}
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Save POD
          </button>
        </form>

        <form onSubmit={saveFuel} className="space-y-3 text-[13px] border-t pt-4">
          <h2 className="font-semibold">Fuel report (L-05)</h2>
          <div className="flex flex-wrap gap-4">
            <label>
              Liters
              <input
                type="number"
                step="0.01"
                min="0"
                className="mt-1 block rounded border px-2 py-1"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
              />
            </label>
            <label>
              Cost (AZN)
              <input
                type="number"
                step="0.01"
                min="0"
                className="mt-1 block rounded border px-2 py-1"
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
              />
            </label>
          </div>
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Save fuel report
          </button>
        </form>
      </div>
    </>
  );
}
