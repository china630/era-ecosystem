"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Appointment = {
  id: string;
  vehiclePlate: string;
  customerName?: string | null;
  scheduledAt: string;
  status: string;
  workOrder?: { code: string } | null;
};

const bookFormId = "book-appointment-form";

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/appointments");
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehiclePlate,
        customerName: customerName || undefined,
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("bookingFailed"));
      return;
    }
    setMessage(
      data.calendarAdjusted ? t("calendarAdjusted") : t("booked", { plate: data.vehiclePlate }),
    );
    setVehiclePlate("");
    setCustomerName("");
    setScheduledAt("");
    setModalOpen(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {t("book")}
            </button>
            <Link href="/work-orders" className={PRIMARY_BUTTON_CLASS}>
              {t("workOrders")}
            </Link>
          </>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {message && <p className="text-[13px]">{message}</p>}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">{t("upcoming")}</h2>
          <ul className="space-y-2 text-[13px]">
            {appointments.map((a) => (
              <li key={a.id} className="rounded border p-2">
                <div className="font-medium">{a.vehiclePlate}</div>
                <div className="text-[#7F8C8D]">
                  {a.customerName ?? "—"} ·{" "}
                  {new Date(a.scheduledAt).toLocaleString()} · {a.status}
                </div>
                {a.workOrder && (
                  <Link href="/work-orders" className="text-[#2980B9] underline">
                    WO {a.workOrder.code}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ModalShell
        open={modalOpen}
        title={t("bookTitle")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={bookFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t("book")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={bookFormId} onSubmit={book} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("vehiclePlate")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("customerName")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("book")}</label>
            <input
              type="datetime-local"
              className={MODAL_INPUT_CLASS}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
