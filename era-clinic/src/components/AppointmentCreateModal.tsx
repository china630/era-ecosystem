"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldSelect,
  LINK_ACCENT_CLASS,
  ModalFooter,
  ModalShell,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type Practitioner = { code: string; fullName: string };
type PatientOption = { id: string; refCode: string; fullName: string };

export type AppointmentCreatePrefill = {
  practitionerCode?: string;
  scheduledAtIso?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  prefill?: AppointmentCreatePrefill | null;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentCreateModal({ open, onClose, onCreated, prefill }: Props) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientRefId, setPatientRefId] = useState("");
  const [practitionerCode, setPractitionerCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPatientRefId("");
    void fetch("/api/admin/practitioners")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d) as Array<{ code: string; fullName: string }>;
        setPractitioners(Array.isArray(rows) ? rows : []);
        const preferred = prefill?.practitionerCode;
        if (preferred && rows.some((p) => p.code === preferred)) {
          setPractitionerCode(preferred);
        } else if (rows[0]) {
          setPractitionerCode(rows[0].code);
        }
      });
    void fetch("/api/patients?pageSize=100")
      .then((r) => r.json())
      .then((d) => {
        const payload = (d.data ?? d) as { items?: PatientOption[] } | PatientOption[];
        setPatients(Array.isArray(payload) ? payload : (payload.items ?? []));
      });
    if (prefill?.scheduledAtIso) {
      setScheduledAt(toDatetimeLocal(prefill.scheduledAtIso));
    }
  }, [open, prefill?.practitionerCode, prefill?.scheduledAtIso]);

  async function submit() {
    if (!patientRefId) {
      setError(t("patientRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefId,
        practitionerCode,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? tc("failed"));
      return;
    }
    setPatientRefId("");
    onCreated();
    onClose();
  }

  return (
    <ModalShell open={open} title={t("createTitle")} onClose={onClose}>
      <div className="space-y-4">
        <FieldSelect
          label={t("selectPatient")}
          preset="selectWide"
          value={patientRefId}
          onChange={(e) => setPatientRefId(e.target.value)}
        >
          <option value="">{t("selectPatient")}</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} ({p.refCode})
            </option>
          ))}
        </FieldSelect>
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
          {t("registerFirstHint")}{" "}
          <Link href="/patients" className={LINK_ACCENT_CLASS}>
            {t("goToPatients")}
          </Link>
        </p>
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
        {error ? <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{error}</p> : null}
      </div>
      <ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel={busy ? "…" : tc("save")} />
    </ModalShell>
  );
}
