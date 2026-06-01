"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
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
  const t = useTranslations("labOrders");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (criticalOnly) params.set("criticalOnly", "true");
    const query = params.toString() ? `?${params}` : "";
    fetch(`/api/lab-orders${query}`)
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [statusFilter, criticalOnly]);

  async function completeOrder(id: string) {
    await fetch(`/api/lab-orders/${id}/complete`, { method: "POST" });
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "COMPLETED" } : o)),
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => {
              setLoading(true);
              setCriticalOnly(e.target.checked);
            }}
          />
          {t("criticalOnly")}
        </label>
        <ColorLegend
          className="mb-2"
          items={[
            { id: "ordered", label: "ORDERED", swatchClassName: "bg-slate-100" },
            { id: "ready", label: "RESULT_READY", swatchClassName: "bg-blue-50" },
            { id: "done", label: "COMPLETED", swatchClassName: "bg-green-50" },
          ]}
        />
        <label className="flex items-center gap-2 text-[13px]">
          {t("statusFilter")}
          <select
            className="rounded border px-2 py-1"
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">{tc("all")}</option>
            <option value="ORDERED">ORDERED</option>
            <option value="COLLECTED">COLLECTED</option>
            <option value="RESULT_READY">RESULT_READY</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </label>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
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
                    {tc("complete")}
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
