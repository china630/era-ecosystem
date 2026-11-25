"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@/lib/baku-day";

type PortalResultLine = {
  code?: string;
  name?: string | null;
  value?: string;
  unit?: string | null;
  flag?: string | null;
};

type PortalLabOrder = {
  id?: string;
  testCode?: string;
  publishedAt?: string | null;
  results?: PortalResultLine[];
};

type PortalAppointment = {
  id: string;
  scheduledAt: string;
  status: string;
  mode?: string;
  videoRoomUrl?: string | null;
  practitionerName?: string;
};

type PortalPayload = {
  error?: string;
  patientName?: string;
  labResults?: PortalLabOrder[];
  appointments?: PortalAppointment[];
  data?: Omit<PortalPayload, "data">;
};

export default function PortalPage() {
  const t = useTranslations("portal");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [labOrders, setLabOrders] = useState<PortalLabOrder[]>([]);
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);

  const flatResults = useMemo(
    () =>
      labOrders.flatMap((order) =>
        (order.results ?? []).map((row) => ({
          ...row,
          panel: order.testCode ?? order.id,
        })),
      ),
    [labOrders],
  );

  async function load() {
    setError("");
    setLabOrders([]);
    setAppointments([]);
    setPatientName("");
    const res = await fetch(`/api/portal/session?token=${encodeURIComponent(token)}`);
    const raw = (await res.json()) as PortalPayload;
    if (!res.ok) {
      setError(raw.error ?? t("loadFailed"));
      return;
    }
    const body = raw.data ?? raw;
    setPatientName(body.patientName ?? "");
    setLabOrders(Array.isArray(body.labResults) ? body.labResults : []);
    setAppointments(Array.isArray(body.appointments) ? body.appointments : []);
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-4 p-4`}>
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("token")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("load")}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {patientName && <p className="text-sm font-medium">{patientName}</p>}

        {appointments.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">{t("appointmentsTitle")}</h2>
            <ul className="space-y-2 text-sm">
              {appointments.map((row) => (
                <li key={row.id} className="rounded border border-slate-100 p-2">
                  <p className="font-medium">{bakuDateTimeDisplay(row.scheduledAt)}</p>
                  <p className="text-slate-600">{row.practitionerName ?? "—"}</p>
                  <p className="text-xs uppercase text-slate-500">{row.status}</p>
                  {row.mode === "VIDEO" && row.videoRoomUrl ? (
                    <Link href={`/telehealth?room=${encodeURIComponent(row.videoRoomUrl)}`} className="text-xs text-[#2980B9]">
                      {t("joinVideo")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {flatResults.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">{t("resultsTitle")}</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-1 pr-2">{t("colTest")}</th>
                  <th className="py-1 pr-2">{t("colValue")}</th>
                  <th className="py-1">{t("colFlag")}</th>
                </tr>
              </thead>
              <tbody>
                {flatResults.map((row, i) => (
                  <tr key={`${row.code ?? i}-${i}`} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{row.name ?? row.code ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {row.value ?? "—"}
                      {row.unit ? ` ${row.unit}` : ""}
                    </td>
                    <td className="py-1">{row.flag ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {!error && flatResults.length === 0 && appointments.length === 0 && patientName && (
          <p className="text-sm text-slate-500">{t("emptyResults")}</p>
        )}
      </div>
    </main>
  );
}