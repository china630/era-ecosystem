"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import AppointmentCreateModal from "@/components/AppointmentCreateModal";

type AppointmentRow = {
  id: string;
  status: string;
  scheduledAt: string;
  patientRef: { refCode: string; fullName: string };
  practitioner: { code: string; fullName: string };
  visit?: { id: string; status: string; amountNet: string; patientOrigin?: string } | null;
};

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cpoeOpen, setCpoeOpen] = useState(false);
  const [cpoeJson, setCpoeJson] = useState("{}");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; code: string; title: string; bodyJson: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/appointments");
    const d = await res.json();
    setRows(Array.isArray(d) ? d : (d.data ?? []));
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates((d.data ?? d) as typeof templates));
  }, [load]);

  async function cancelVisit(visitId: string) {
    if (!cancelReason.trim()) return;
    await fetch(`/api/visits/${visitId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim() }),
    });
    setCancelOpen(false);
    setCancelReason("");
    await load();
  }

  async function checkIn(id: string) {
    await fetch(`/api/appointments/${id}/check-in`, { method: "POST" });
    await load();
  }

  async function saveCpoe(visitId: string) {
    await fetch(`/api/visits/${visitId}/cpoe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payloadJson: cpoeJson }),
    });
    setCpoeOpen(false);
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
            {t("createTitle")}
          </button>
        }
      />
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
                Visit {selected.visit.id.slice(0, 8)} · {selected.visit.status}
                {selected.visit.patientOrigin ? ` · ${selected.visit.patientOrigin}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.status === "SCHEDULED" && (
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void checkIn(selected.id)}>
                    Check-in
                  </button>
                )}
                <Link href={`/visits/${selected.visit.id}`} className={PRIMARY_BUTTON_CLASS}>
                  Visit card
                </Link>
                <Link href={`/cashier?visitId=${selected.visit.id}`} className={PRIMARY_BUTTON_CLASS}>
                  Cashier
                </Link>
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCpoeOpen(true)}>
                  CPOE
                </button>
                {selected.visit.status !== "COMPLETED" &&
                  selected.visit.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      onClick={() => setCancelOpen(true)}
                    >
                      {t("cancelVisit")}
                    </button>
                  )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t("shellNote")}</p>
          )}
        </div>
      </div>
      <AppointmentCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      <ModalShell open={cancelOpen} title={t("cancelTitle")} onClose={() => setCancelOpen(false)}>
        <textarea
          className={`${MODAL_INPUT_CLASS} min-h-[80px]`}
          placeholder={t("cancelReason")}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setCancelOpen(false)}
          onSubmit={() => selected?.visit && void cancelVisit(selected.visit.id)}
          submitLabel={t("cancelConfirm")}
        />
      </ModalShell>
      <ModalShell open={cpoeOpen} title="CPOE" onClose={() => setCpoeOpen(false)}>
        <label className="mb-2 block text-xs">
          Template
          <select
            className="mt-1 w-full rounded border p-2 text-xs"
            value={selectedTemplateId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTemplateId(id);
              const tpl = templates.find((t) => t.id === id);
              if (tpl?.bodyJson) setCpoeJson(tpl.bodyJson);
            }}
          >
            <option value="">—</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.code} — {tpl.title}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="w-full rounded border p-2 text-xs"
          rows={8}
          value={cpoeJson}
          onChange={(e) => setCpoeJson(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setCpoeOpen(false)}
          onSubmit={() => selected?.visit && void saveCpoe(selected.visit.id)}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </>
  );
}
