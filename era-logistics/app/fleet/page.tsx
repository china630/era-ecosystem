"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type FleetAlert = {
  vehicleId: string;
  plate: string;
  type: string;
  expiresAt: string;
};

export default function FleetPage() {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/fleet/alerts")
      .then((res) => res.json())
      .then((data) => {
        if (!data.alerts) {
          setMessage(data.error ?? "Failed to load alerts");
          setAlerts([]);
          return;
        }
        setDaysAhead(data.daysAhead ?? 30);
        setAlerts(data.alerts);
      })
      .catch(() => setMessage("Failed to load fleet alerts"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Fleet compliance"
        subtitle={`M7 — documents expiring within ${daysAhead} days`}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        {message && <p className="text-[13px]">{message}</p>}
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">No upcoming expirations.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {alerts.map((a, i) => (
              <li key={`${a.vehicleId}-${a.type}-${i}`} className="rounded border p-3">
                <strong>{a.plate}</strong> — {a.type}{" "}
                <span className="text-[#C0392B]">
                  expires {new Date(a.expiresAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
