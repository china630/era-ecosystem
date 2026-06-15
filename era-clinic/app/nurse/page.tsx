"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  status: string;
  patientRef: { fullName: string };
};

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<Proc[]>([]);
  const [completeId, setCompleteId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/procedures");
    const d = await res.json();
    const rows = (d.data ?? d) as Proc[];
    setOrders(rows.filter((o) => o.status === "SCHEDULED"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirmComplete() {
    if (!completeId) return;
    await fetch(`/api/procedures/${completeId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableLines: [{ sku: "CONS-1", qty: 1 }],
        amountNet: 0,
      }),
    });
    setCompleteId(null);
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
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCompleteId(o.id)}>
                {t("done")}
              </button>
            </li>
          ))}
          {orders.length === 0 && <li className="text-slate-500">{t("empty")}</li>}
        </ul>
      </div>

      <ModalShell open={!!completeId} title={t("completeConfirmTitle")} onClose={() => setCompleteId(null)}>
        <p className="text-[13px]">{t("completeConfirmBody")}</p>
        <ModalFooter
          onCancel={() => setCompleteId(null)}
          onSubmit={() => void confirmComplete()}
          submitLabel={t("done")}
        />
      </ModalShell>
    </>
  );
}
