"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldRow,
  FieldSelect,
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
      <div className="space-y-4">
        <FieldRow cols={2}>
          <Field
            label={t("patientRefCode")}
            preset="code"
            value={patientRefCode}
            onChange={(e) => setPatientRefCode(e.target.value)}
          />
          <Field
            label={t("patientPhone")}
            preset="phone"
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
          />
        </FieldRow>
        <Field
          label={t("patientName")}
          preset="shortText"
          value={patientFullName}
          onChange={(e) => setPatientFullName(e.target.value)}
        />
        <FieldSelect
          label={t("practitioner")}
          preset="selectWide"
          value={practitionerCode}
          onChange={(e) => setPractitionerCode(e.target.value)}
        >
          {practitioners.map((p) => (
            <option key={p.code} value={p.code}>
              {p.fullName} ({p.code})
            </option>
          ))}
        </FieldSelect>
        <Field
          label={t("scheduledAt")}
          preset="longText"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        {error ? <p className="text-[13px] text-[#C0392B]">{error}</p> : null}
      </div>
      <ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel={busy ? "…" : tc("save")} />
    </ModalShell>
  );
}
