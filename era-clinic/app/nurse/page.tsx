"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  status: string;
  patientRef: { id: string; fullName: string };
};

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<Proc[]>([]);
  const [overdue, setOverdue] = useState<Proc[]>([]);
  const [qrToken, setQrToken] = useState("");
  const [activeQrToken, setActiveQrToken] = useState<string | null>(null);
  const [qrOrders, setQrOrders] = useState<Proc[]>([]);
  const [qrPatient, setQrPatient] = useState<string | null>(null);
  const [qrPatientRefId, setQrPatientRefId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");

  async function load() {
    const res = await fetch("/api/procedures");
    const d = await res.json();
    const rows = (d.data ?? d) as Proc[];
    setOrders(rows.filter((o) => ["SCHEDULED", "CHECKED_IN"].includes(o.status)));
    const overdueRes = await fetch("/api/nurse/overdue");
    if (overdueRes.ok) {
      const od = await overdueRes.json();
      setOverdue((od.data ?? od) as Proc[]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function show(message: string, tone: "ok" | "err" = "ok") {
    setMsg(message);
    setMsgTone(tone);
  }

  async function scanQr() {
    show("");
    const res = await fetch("/api/nurse/qr-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: qrToken.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("qrFailed"), "err");
      setQrOrders([]);
      setQrPatient(null);
      setQrPatientRefId(null);
      setActiveQrToken(null);
      return;
    }
    const payload = data.data ?? data;
    setQrPatient(payload.patientName ?? null);
    setQrPatientRefId(payload.patientRefId ?? null);
    setQrOrders(payload.orders ?? []);
    setActiveQrToken(payload.qrToken ?? qrToken.trim());
    show(t("qrSuccess"));
  }

  async function checkIn(id: string) {
    if (!activeQrToken) {
      show(t("qrRequiredFirst"), "err");
      return;
    }
    const res = await fetch(`/api/procedures/${id}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: activeQrToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("checkInFailed"), "err");
      return;
    }
    show(t("checkInOk"));
    await load();
    if (qrToken.trim()) await scanQr();
  }

  async function markNoShow(id: string) {
    const res = await fetch(`/api/procedures/${id}/no-show`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("noShowFailed"), "err");
      return;
    }
    show(t("noShowOk"));
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
      show(data.error ?? t("completeFailed"), "err");
    } else {
      show(t("completeOk"));
    }
    setCompleteId(null);
    await load();
    if (qrToken.trim()) await scanQr();
  }

  function renderOrderRow(o: Proc, opts?: { requireQr?: boolean }) {
    const canCheckIn = o.status === "SCHEDULED";
    const canComplete = o.status === "CHECKED_IN";
    return (
      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
        <span>
          <Link href={`/patients/${o.patientRef.id}`} className="font-medium text-[#2980B9] hover:underline">
            {o.patientRef.fullName}
          </Link>
          {" — "}
          {o.procedureName} @ {new Date(o.scheduledAt).toLocaleTimeString()} ({o.status})
        </span>
        <span className="flex flex-wrap gap-2">
          {canCheckIn && opts?.requireQr !== false ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void checkIn(o.id)}
              disabled={!activeQrToken}
              title={!activeQrToken ? t("qrRequiredFirst") : undefined}
            >
              {t("checkIn")}
            </button>
          ) : null}
          {canCheckIn ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void markNoShow(o.id)}
            >
              {t("noShow")}
            </button>
          ) : null}
          {canComplete ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCompleteId(o.id)}>
              {t("done")}
            </button>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {msg && (
        <p className={`mb-3 text-sm ${msgTone === "err" ? "text-red-700" : "text-emerald-700"}`}>
          {msg}
        </p>
      )}

      <div className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">{t("qrScanTitle")}</h2>
        <p className="text-[12px] text-[#7F8C8D]">{t("qrHint")}</p>
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
            {t("qrPatient")}:{" "}
            {qrPatientRefId ? (
              <Link href={`/patients/${qrPatientRefId}`} className="text-[#2980B9] hover:underline">
                {qrPatient}
              </Link>
            ) : (
              qrPatient
            )}
          </p>
        )}
        {qrOrders.length > 0 && (
          <ul className="space-y-2 text-sm">{qrOrders.map((o) => renderOrderRow(o))}</ul>
        )}
      </div>

      {overdue.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 border-amber-300 bg-amber-50 p-4`}>
          <h2 className="mb-2 text-sm font-semibold text-amber-900">{t("overdueTitle")}</h2>
          <p className="mb-2 text-[12px] text-amber-800">{t("overdueHint")}</p>
          <ul className="space-y-2 text-sm">
            {overdue.map((o) => renderOrderRow(o, { requireQr: true }))}
          </ul>
        </div>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-2 text-sm font-semibold">{t("todayList")}</h2>
        <p className="mb-2 text-[12px] text-[#7F8C8D]">{t("todayListHint")}</p>
        <ul className="space-y-2 text-sm">
          {orders
            .filter((o) => o.status === "CHECKED_IN")
            .map((o) => renderOrderRow(o, { requireQr: false }))}
          {orders.filter((o) => o.status === "CHECKED_IN").length === 0 && (
            <li className="text-slate-500">{t("emptyCheckedIn")}</li>
          )}
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
