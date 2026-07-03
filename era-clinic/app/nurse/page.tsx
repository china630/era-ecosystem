"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
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
  const [qrToken, setQrToken] = useState("");
  const [qrOrders, setQrOrders] = useState<Proc[]>([]);
  const [qrPatient, setQrPatient] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/procedures");
    const d = await res.json();
    const rows = (d.data ?? d) as Proc[];
    setOrders(rows.filter((o) => ["SCHEDULED", "IN_PROGRESS"].includes(o.status)));
  }

  useEffect(() => {
    void load();
  }, []);

  async function scanQr() {
    setMsg("");
    const res = await fetch("/api/nurse/qr-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: qrToken.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? t("qrFailed"));
      setQrOrders([]);
      setQrPatient(null);
      return;
    }
    const payload = data.data ?? data;
    setQrPatient(payload.patientName ?? null);
    setQrOrders(payload.orders ?? []);
    setMsg(t("qrSuccess"));
  }

  async function startProcedure(id: string) {
    await fetch(`/api/procedures/${id}/start`, { method: "POST" });
    await load();
    if (qrToken.trim()) await scanQr();
  }

  async function confirmComplete() {
    if (!completeId) return;
    const res = await fetch(`/api/procedures/${completeId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableLines: [{ sku: "CONS-1", qty: 1 }],
        amountNet: 0,
        confirmOverQuota: true,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMsg(data.error ?? t("completeFailed"));
    }
    setCompleteId(null);
    await load();
    if (qrToken.trim()) await scanQr();
  }

  function renderOrderRow(o: Proc) {
    return (
      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
        <span>
          {o.patientRef.fullName} — {o.procedureName} @{" "}
          {new Date(o.scheduledAt).toLocaleTimeString()} ({o.status})
        </span>
        <span className="flex gap-2">
          {o.status === "SCHEDULED" && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void startProcedure(o.id)}
            >
              {t("start")}
            </button>
          )}
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCompleteId(o.id)}>
            {t("done")}
          </button>
        </span>
      </li>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {msg && <p className="mb-3 text-sm text-emerald-700">{msg}</p>}

      <div className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">{t("qrScanTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("qrTokenPlaceholder")}
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void scanQr()}>
            {t("qrScan")}
          </button>
        </div>
        {qrPatient && (
          <p className="text-sm">
            {t("qrPatient")}: {qrPatient}
          </p>
        )}
        {qrOrders.length > 0 && (
          <ul className="space-y-2 text-sm">{qrOrders.map(renderOrderRow)}</ul>
        )}
      </div>

      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-2 text-sm font-semibold">{t("todayList")}</h2>
        <ul className="space-y-2 text-sm">
          {orders.map(renderOrderRow)}
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
