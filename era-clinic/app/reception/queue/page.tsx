"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type QueueTicket = {
  id: string;
  queueNumber: number;
  status: string;
  desk?: string | null;
  calledAt?: string | null;
  visit: {
    patientRef: { fullName: string };
    practitioner: { fullName: string };
  };
};

export default function ReceptionQueuePage() {
  const t = useTranslations("queue");
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [lastCalled, setLastCalled] = useState<QueueTicket | null>(null);

  async function load() {
    const res = await fetch("/api/queue/board");
    const d = await res.json();
    const rows = (d.data?.tickets ?? d.tickets ?? []) as QueueTicket[];
    setTickets(rows);
    const called = rows.find((x) => x.status === "CALLED");
    if (called) setLastCalled(called);
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  async function callNext() {
    const waiting = tickets.find((x) => x.status === "WAITING");
    if (!waiting) return;
    const res = await fetch(`/api/queue/tickets/${waiting.id}/call`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desk: "Desk 1" }),
    });
    const updated = await res.json();
    const ticket = (updated.data ?? updated) as QueueTicket;
    setLastCalled(ticket);
    await load();
    window.print();
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="queue-board grid gap-4 lg:grid-cols-2">
        <div className={`${CARD_CONTAINER_CLASS} p-4 no-print`}>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void callNext()}>
            {t("callNext")}
          </button>
          <ul className="mt-4 space-y-2 text-sm">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex justify-between rounded border p-2">
                <span>
                  #{ticket.queueNumber} {ticket.visit.patientRef.fullName}
                </span>
                <span className="text-xs text-slate-500">{ticket.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div id="queue-ticket-print" className={`${CARD_CONTAINER_CLASS} p-6 print-ticket`}>
          {lastCalled ? (
            <>
              <p className="text-xs uppercase text-slate-500">{t("nowServing")}</p>
              <p className="text-5xl font-bold">#{lastCalled.queueNumber}</p>
              <p className="mt-2 text-lg">{lastCalled.visit.patientRef.fullName}</p>
              <p className="text-sm text-slate-600">
                {lastCalled.visit.practitioner.fullName}
                {lastCalled.desk ? ` · ${lastCalled.desk}` : ""}
              </p>
            </>
          ) : (
            <p className="text-slate-500">{t("empty")}</p>
          )}
        </div>
      </div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-ticket,
          .print-ticket * {
            visibility: visible;
          }
          .print-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
