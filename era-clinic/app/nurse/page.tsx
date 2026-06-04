"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  patientRef: { fullName: string };
};

export default function NursePage() {
  const t = useTranslations("nurse");
  const [orders, setOrders] = useState<Proc[]>([]);

  async function load() {
    const res = await fetch("/api/procedures");
    const d = await res.json();
    setOrders(d.data ?? d);
  }

  useEffect(() => {
    void load();
  }, []);

  async function complete(id: string) {
    await fetch(`/api/procedures/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableLines: [{ sku: "CONS-1", qty: 1 }],
        amountNet: 0,
      }),
    });
    await load();
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <ul className="space-y-2 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {o.patientRef.fullName} — {o.procedureName} @{" "}
                {new Date(o.scheduledAt).toLocaleTimeString()}
              </span>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void complete(o.id)}
              >
                {t("done")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
