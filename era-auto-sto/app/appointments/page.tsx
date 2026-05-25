"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Appointment = {
  id: string;
  vehiclePlate: string;
  customerName?: string | null;
  scheduledAt: string;
  status: string;
  workOrder?: { code: string } | null;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/appointments");
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehiclePlate,
        customerName: customerName || undefined,
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Booking failed");
      return;
    }
    setMessage(`Booked ${data.vehiclePlate}`);
    setVehiclePlate("");
    setCustomerName("");
    setScheduledAt("");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="A2 — book service slots"
        actions={
          <Link href="/work-orders" className={PRIMARY_BUTTON_CLASS}>
            Work orders
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        <form onSubmit={book} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold">Book appointment</h2>
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Vehicle plate"
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value)}
            required
          />
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            type="datetime-local"
            className="block w-full rounded border px-2 py-1 text-[13px]"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Book
          </button>
        </form>
        {message && <p className="text-[13px]">{message}</p>}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Upcoming</h2>
          <ul className="space-y-2 text-[13px]">
            {appointments.map((a) => (
              <li key={a.id} className="rounded border p-2">
                <div className="font-medium">{a.vehiclePlate}</div>
                <div className="text-[#7F8C8D]">
                  {a.customerName ?? "—"} ·{" "}
                  {new Date(a.scheduledAt).toLocaleString()} · {a.status}
                </div>
                {a.workOrder && (
                  <Link href="/work-orders" className="text-[#2980B9] underline">
                    WO {a.workOrder.code}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
