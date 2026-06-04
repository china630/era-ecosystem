"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type AppointmentRow = {
  id: string;
  status: string;
  scheduledAt: string;
  patientRef: { refCode: string; fullName: string };
  practitioner: { code: string; fullName: string };
  visit?: { id: string; status: string; amountNet: string } | null;
};

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [cpoeJson, setCpoeJson] = useState("{}");

  useEffect(() => {
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : (d.data ?? [])));
  }, []);

  async function checkIn(id: string) {
    await fetch(`/api/appointments/${id}/check-in`, { method: "POST" });
    const res = await fetch("/api/appointments");
    const d = await res.json();
    setRows(Array.isArray(d) ? d : (d.data ?? []));
  }

  async function saveCpoe(visitId: string) {
    await fetch(`/api/visits/${visitId}/cpoe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payloadJson: cpoeJson }),
    });
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <ul className="space-y-2 text-sm">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex cursor-pointer items-center justify-between rounded border p-2 hover:bg-slate-50"
                onClick={() => setSelected(a)}
              >
                <span>
                  {a.patientRef.fullName} · {new Date(a.scheduledAt).toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">{a.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {selected?.visit ? (
            <>
              <h3 className="font-semibold">{selected.patientRef.fullName}</h3>
              <p className="text-xs text-slate-500">
                Visit {selected.visit.id} · {selected.visit.status}
              </p>
              <div className="mt-3 flex gap-2">
                {selected.status === "SCHEDULED" && (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void checkIn(selected.id)}
                  >
                    Check-in
                  </button>
                )}
                <Link href={`/cashier?visitId=${selected.visit.id}`} className={PRIMARY_BUTTON_CLASS}>
                  Cashier
                </Link>
              </div>
              <textarea
                className="mt-4 w-full rounded border p-2 text-xs"
                rows={6}
                value={cpoeJson}
                onChange={(e) => setCpoeJson(e.target.value)}
              />
              <button
                type="button"
                className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                onClick={() => void saveCpoe(selected.visit!.id)}
              >
                Save CPOE
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t("shellNote")}</p>
          )}
        </div>
      </div>
    </>
  );
}
