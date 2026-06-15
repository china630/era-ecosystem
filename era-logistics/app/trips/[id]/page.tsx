"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Trip = {
  id: string;
  status: string;
  routeCode?: string | null;
  freightAmount: string | number;
  startedAt?: string | null;
  completedAt?: string | null;
  podRecipient?: string | null;
  podNotes?: string | null;
  podPhotoUrl?: string | null;
  podSignatureUrl?: string | null;
  podCapturedAt?: string | null;
  waybillNumber?: string | null;
  waybillIssuedAt?: string | null;
  fuelLiters?: string | number | null;
  fuelCost?: string | number | null;
  vehicle: { plate: string; model?: string | null };
};

const STATUS_STEPS = ["PLANNED", "IN_TRANSIT", "DELIVERED", "COMPLETED"] as const;

const podFormId = "trip-pod-form";
const fuelFormId = "trip-fuel-form";

export default function TripDetailPage() {
  const t = useTranslations("tripsDetail");
  const tc = useTranslations("common");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [trip, setTrip] = useState<Trip | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [podRecipient, setPodRecipient] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [podPhotoUrl, setPodPhotoUrl] = useState("");
  const [podSignatureUrl, setPodSignatureUrl] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [slaEta, setSlaEta] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/trips/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("notFound"));
      setTrip(null);
      setLoading(false);
      return;
    }
    setTrip(data);
    setPodRecipient(data.podRecipient ?? "");
    setPodNotes(data.podNotes ?? "");
    setPodPhotoUrl(data.podPhotoUrl ?? "");
    setPodSignatureUrl(data.podSignatureUrl ?? "");
    setFuelLiters(data.fuelLiters != null ? String(data.fuelLiters) : "");
    setFuelCost(data.fuelCost != null ? String(data.fuelCost) : "");
    const from = new Date().toISOString().slice(0, 10);
    void fetch(`/api/sla/eta?from=${from}&days=3`)
      .then((r) => r.json())
      .then((d) => setSlaEta(d.eta ?? null))
      .catch(() => setSlaEta(null));
    setLoading(false);
  }, [id, t]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  async function advanceStatus(next: "IN_TRANSIT" | "DELIVERED") {
    setMessage("");
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("statusUpdateFailed"));
      return;
    }
    setTrip(data);
    setMessage(t("statusChanged", { status: data.status }));
  }

  async function savePod(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/trips/${id}/pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: podRecipient,
        notes: podNotes || undefined,
        podPhotoUrl: podPhotoUrl.trim() || undefined,
        podSignatureUrl: podSignatureUrl.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("podSaveFailed"));
      return;
    }
    setTrip(data);
    setMessage(t("podSaved"));
    setPodModalOpen(false);
  }

  async function saveFuel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const liters = parseFloat(fuelLiters);
    const cost = parseFloat(fuelCost);
    if (!Number.isFinite(liters) || liters <= 0 || !Number.isFinite(cost) || cost < 0) {
      setBusy(false);
      setMessage(t("invalidFuel"));
      return;
    }
    const res = await fetch(`/api/trips/${id}/fuel-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liters, cost }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("fuelReportFailed"));
      return;
    }
    await loadTrip();
    setMessage(t("fuelRecorded", { liters: data.liters, cost: data.cost }));
    setFuelModalOpen(false);
  }

  async function issueWaybill() {
    setMessage("");
    const res = await fetch(`/api/trips/${id}/waybill`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("waybillFailed"));
      return;
    }
    setTrip(data);
    setMessage(t("waybillIssued", { number: data.waybillNumber }));
  }

  async function completeTrip() {
    setMessage("");
    if (!trip?.podCapturedAt) {
      const strict = process.env.NEXT_PUBLIC_STRICT_POD === "true";
      const warn = t("podWarn");
      if (strict) {
        setMessage(warn);
        return;
      }
      if (!window.confirm(warn)) return;
    }
    const res = await fetch(`/api/trips/${id}/complete`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("completeFailed"));
      return;
    }
    setTrip(data);
    setMessage(t("tripCompleted"));
  }

  if (loading) {
    return (
      <p className={`${CARD_CONTAINER_CLASS} p-6 text-[13px] text-[#7F8C8D]`}>
        {tc("loading")}
      </p>
    );
  }

  if (!trip) {
    return (
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-3`}>
        <p className="text-[13px]">{message || t("notFound")}</p>
        <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
          {t("backToTrips")}
        </Link>
      </div>
    );
  }

  const stepIndex = STATUS_STEPS.indexOf(trip.status as (typeof STATUS_STEPS)[number]);

  return (
    <>
      <PageHeader
        title={t("tripTitle", { id: trip.id.slice(0, 8) })}
        subtitle={`${trip.vehicle.plate}${trip.routeCode ? ` · ${trip.routeCode}` : ""}`}
        actions={
          <Link href="/trips" className={PRIMARY_BUTTON_CLASS}>
            {t("allTrips")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {message && <p className="text-[13px]">{message}</p>}

        <section className="space-y-2 text-[13px]">
          <h2 className="font-semibold">{t("overview")}</h2>
          <p>
            {t("vehicle")}: <strong>{trip.vehicle.plate}</strong>
            {trip.vehicle.model ? ` (${trip.vehicle.model})` : ""}
          </p>
          <p>
            {t("freight")}: {Number(trip.freightAmount).toFixed(2)} AZN
          </p>
          <p>
            {t("status")}: <strong>{trip.status}</strong>
          </p>
          <ColorLegend
            ariaLabel={t("status")}
            items={[
              { id: "active", label: "Reached", swatchClassName: "bg-[#2980B9]" },
              { id: "pending", label: "Upcoming", swatchClassName: "bg-[#ECF0F1]" },
            ]}
          />
          <ol className="flex flex-wrap gap-2">
            {STATUS_STEPS.map((s, i) => (
              <li
                key={s}
                className={`rounded px-2 py-0.5 text-[12px] ${
                  i <= stepIndex ? "bg-[#2980B9] text-white" : "bg-[#ECF0F1] text-[#7F8C8D]"
                }`}
              >
                {s}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2 text-[13px] border-t pt-4">
          <h2 className="font-semibold">{t("waybill")}</h2>
          {trip.waybillNumber ? (
            <p>
              <strong>{trip.waybillNumber}</strong>
              {trip.waybillIssuedAt
                ? ` · ${new Date(trip.waybillIssuedAt).toLocaleString()}`
                : ""}
            </p>
          ) : (
            <p className="text-[12px] text-[#7F8C8D]">{t("notIssued")}</p>
          )}
          {!trip.waybillNumber && (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void issueWaybill()}>
              {t("issueWaybill")}
            </button>
          )}
        </section>

        <section className="space-y-2 text-[13px]">
          <h2 className="font-semibold">{t("statusActions")}</h2>
          {trip.status === "PLANNED" && slaEta ? (
            <p className="text-[12px] text-[#2980B9]">
              {t("slaEta")}: {slaEta} ({t("businessDays")}: 3)
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {trip.status === "PLANNED" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => advanceStatus("IN_TRANSIT")}
              >
                {t("startTrip")}
              </button>
            )}
            {trip.status === "IN_TRANSIT" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => advanceStatus("DELIVERED")}
              >
                {t("markDelivered")}
              </button>
            )}
            {trip.status !== "COMPLETED" && trip.status !== "CANCELLED" && (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void completeTrip()}
              >
                {t("completeTrip")}
              </button>
            )}
          </div>
        </section>

        <section className="space-y-2 text-[13px] border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("pod")}</h2>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setPodModalOpen(true)}>
              {t("savePod")}
            </button>
          </div>
          {trip.podCapturedAt && (
            <p className="text-[12px] text-[#7F8C8D]">
              {t("captured")}: {new Date(trip.podCapturedAt).toLocaleString()}
              {trip.podRecipient ? ` · ${trip.podRecipient}` : ""}
            </p>
          )}
        </section>

        <section className="space-y-2 text-[13px] border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("fuelReport")}</h2>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setFuelModalOpen(true)}>
              {t("saveFuel")}
            </button>
          </div>
          {trip.fuelLiters != null && (
            <p className="text-[12px] text-[#7F8C8D]">
              {t("liters")}: {trip.fuelLiters} · {t("costAzn")}: {trip.fuelCost}
            </p>
          )}
        </section>
      </div>

      <ModalShell
        open={podModalOpen}
        title={t("pod")}
        onClose={() => setPodModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={podFormId}
            onCancel={() => setPodModalOpen(false)}
            busy={busy}
            submitLabel={t("savePod")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={podFormId} onSubmit={savePod} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("recipient")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={podRecipient}
              onChange={(e) => setPodRecipient(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("photoUrl")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={podPhotoUrl}
              onChange={(e) => setPodPhotoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("signatureUrl")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={podSignatureUrl}
              onChange={(e) => setPodSignatureUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("notes")}</label>
            <textarea
              className={MODAL_INPUT_CLASS}
              rows={2}
              value={podNotes}
              onChange={(e) => setPodNotes(e.target.value)}
            />
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={fuelModalOpen}
        title={t("fuelReport")}
        onClose={() => setFuelModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={fuelFormId}
            onCancel={() => setFuelModalOpen(false)}
            busy={busy}
            submitLabel={t("saveFuel")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={fuelFormId} onSubmit={saveFuel} className={FORM_STACK_CLASS}>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("liters")}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={MODAL_INPUT_CLASS}
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                required
              />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("costAzn")}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={MODAL_INPUT_CLASS}
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
                required
              />
            </div>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
