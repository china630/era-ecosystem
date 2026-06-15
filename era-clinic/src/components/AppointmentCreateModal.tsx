"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
} from "@era/satellite-kit/ui";

type Practitioner = { code: string; fullName: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function AppointmentCreateModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [patientRefCode, setPatientRefCode] = useState("");
  const [patientFullName, setPatientFullName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [practitionerCode, setPractitionerCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/admin/practitioners")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d) as Array<{ code: string; fullName: string }>;
        setPractitioners(Array.isArray(rows) ? rows : []);
        if (rows[0]) setPractitionerCode(rows[0].code);
      });
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    const pr = practitioners.find((p) => p.code === practitionerCode);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefCode: patientRefCode.trim(),
        patientFullName: patientFullName.trim(),
        patientPhone: patientPhone.trim() || undefined,
        practitionerCode,
        practitionerFullName: pr?.fullName ?? practitionerCode,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(tc("failed"));
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <ModalShell open={open} title={t("createTitle")} onClose={onClose}>
      <div className="space-y-2">
        <input className={MODAL_INPUT_CLASS} placeholder={t("patientRefCode")} value={patientRefCode} onChange={(e) => setPatientRefCode(e.target.value)} />
        <input className={MODAL_INPUT_CLASS} placeholder={t("patientName")} value={patientFullName} onChange={(e) => setPatientFullName(e.target.value)} />
        <input className={MODAL_INPUT_CLASS} placeholder={t("patientPhone")} value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
        <select className={MODAL_INPUT_CLASS} value={practitionerCode} onChange={(e) => setPractitionerCode(e.target.value)}>
          {practitioners.map((p) => (
            <option key={p.code} value={p.code}>
              {p.fullName} ({p.code})
            </option>
          ))}
        </select>
        <input type="datetime-local" className={MODAL_INPUT_CLASS} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        {error ? <p className="text-[13px] text-[#C0392B]">{error}</p> : null}
      </div>
      <ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel={busy ? "…" : tc("save")} />
    </ModalShell>
  );
}
