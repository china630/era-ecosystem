"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Trip = {
  id: string;
  status: string;
  freightAmount: string | number;
  routeCode?: string | null;
  vehicle: { plate: string };
};

const tripFormId = "logistics-trip-form";

export default function TripsPage() {
  const t = useTranslations("trips");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [freightAmount, setFreightAmount] = useState("0");
  const [message, setMessage] = useState("");

  async function loadTrips() {
    const res = await fetch("/api/trips");
    const data = await res.json();
    setTrips(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void loadTrips();
  }, []);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehiclePlate: vehiclePlate.trim(),
          vehicleModel: vehicleModel.trim() || undefined,
          routeCode: routeCode.trim() || undefined,
          freightAmount: Number(freightAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc("error"));
      setMessage(t("created", { plate: data.vehicle?.plate ?? vehiclePlate.trim() }));
      setVehiclePlate("");
      setVehicleModel("");
      setRouteCode("");
      setFreightAmount("0");
      setModalOpen(false);
      await loadTrips();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tc("error"));
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className={`${PRIMARY_BUTTON_CLASS} mr-2`} onClick={() => setModalOpen(true)}>
              {t("addTrip")}
            </button>
            <Link
              href="/reports/fuel"
              className="mr-2 text-[13px] text-[#2980B9] hover:underline"
            >
              {t("fuelReport")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-3`}>
        {message ? <p className="text-[13px]">{message}</p> : null}
        {trips.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between rounded border p-2 hover:bg-[#F8F9FA]"
                >
                  <span>
                    {trip.vehicle.plate}
                    {trip.routeCode ? ` · ${trip.routeCode}` : ""} —{" "}
                    {Number(trip.freightAmount).toFixed(2)} AZN
                  </span>
                  <span className="text-[12px] text-[#7F8C8D]">{trip.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ModalShell
        open={modalOpen}
        title={t("addTrip")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={tripFormId}
            onCancel={() => setModalOpen(false)}
            submitLabel={t("createTrip")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={tripFormId} onSubmit={createTrip} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("vehiclePlate")}
              preset="code"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              required
            />
            <Field
              label={t("vehicleModel")}
              preset="shortText"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t("routeCode")}
              preset="code"
              value={routeCode}
              onChange={(e) => setRouteCode(e.target.value)}
            />
            <Field
              label={t("freightAmount")}
              preset="amount"
              type="number"
              value={freightAmount}
              onChange={(e) => setFreightAmount(e.target.value)}
              required
            />
          </FieldRow>
        </form>
      </ModalShell>
    </>
  );
}
