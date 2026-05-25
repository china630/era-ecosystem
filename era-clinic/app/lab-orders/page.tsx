"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  patientRef: { refCode: string; fullName: string };
};

export default function LabOrdersPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/lab-orders${query}`)
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function completeOrder(id: string) {
    await fetch(`/api/lab-orders/${id}/complete`, { method: "POST" });
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "COMPLETED" } : o)),
    );
  }

  return (
    <>
      <PageHeader
        title="Laboratory orders"
        subtitle="K2 — order list, status filter, complete action"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <label className="flex items-center gap-2 text-[13px]">
          Status filter
          <select
            className="rounded border px-2 py-1"
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="ORDERED">ORDERED</option>
            <option value="COLLECTED">COLLECTED</option>
            <option value="RESULT_READY">RESULT_READY</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </label>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">No lab orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between rounded border p-3 text-[13px]"
              >
                <div>
                  <Link
                    href={`/lab-orders/${order.id}`}
                    className="font-medium text-[#2980B9] hover:underline"
                  >
                    <strong>{order.testCode}</strong>
                  </Link>{" "}
                  — {order.patientRef.fullName} ({order.patientRef.refCode})
                  <div className="text-[#7F8C8D]">
                    {order.status} · {order.amountNet} AZN
                  </div>
                </div>
                {order.status === "PUBLISHED" && (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => completeOrder(order.id)}
                  >
                    Complete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
