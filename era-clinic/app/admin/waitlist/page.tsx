"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";

type WaitlistRow = {
  id: string;
  patientName: string;
  patientRefCode: string;
  patientRefId: string;
  serviceCode: string | null;
  preferredFrom: string | null;
  status: string;
};

export default function AdminWaitlistPage() {
  const t = useTranslations("waitlist");
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [patientRefId, setPatientRefId] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [preferredFrom, setPreferredFrom] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/waitlist");
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      return;
    }
    setRows((data.items ?? []) as WaitlistRow[]);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addEntry() {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefId: patientRefId.trim(),
        serviceCode: serviceCode.trim() || null,
        preferredFrom: preferredFrom.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("createFailed"));
      return;
    }
    setPatientRefId("");
    setServiceCode("");
    setPreferredFrom("");
    await load();
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("adminTitle")} subtitle={t("adminSubtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} mb-4 grid gap-3 p-4 md:grid-cols-4`}>
        <Field
          label={t("patientRefId")}
          preset="shortText"
          value={patientRefId}
          onChange={(e) => setPatientRefId(e.target.value)}
        />
        <Field
          label={t("serviceCode")}
          preset="code"
          value={serviceCode}
          onChange={(e) => setServiceCode(e.target.value)}
        />
        <Field
          label={t("preferredFrom")}
          preset="shortText"
          value={preferredFrom}
          onChange={(e) => setPreferredFrom(e.target.value)}
          placeholder="YYYY-MM-DD"
        />
        <div className="flex items-end">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addEntry()}>
            {t("add")}
          </button>
        </div>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-600">
              <th className="py-2">{t("colPatient")}</th>
              <th className="py-2">{t("colService")}</th>
              <th className="py-2">{t("colFrom")}</th>
              <th className="py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2">
                  {r.patientName} ({r.patientRefCode})
                </td>
                <td className="py-2">{r.serviceCode ?? "—"}</td>
                <td className="py-2">{r.preferredFrom ?? "—"}</td>
                <td className="py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}