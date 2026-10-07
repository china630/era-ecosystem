"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  FieldSelect,
  LINK_ACCENT_CLASS,
  ModalFooter,
  ModalShell,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { bakuDateKey, bakuTimeLabel, parseBakuDateTime } from "@/lib/baku-day";

type Practitioner = { code: string; fullName: string };
type PatientOption = { id: string; refCode: string; fullName: string };
type VisitService = { code: string; name: string; durationMin: number };

export type AppointmentCreatePrefill = {
  practitionerCode?: string;
  scheduledAtIso?: string;
  defaultDurationMinutes?: number;
  visitServices?: VisitService[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  prefill?: AppointmentCreatePrefill | null;
};

/** datetime-local value as Asia/Baku wall clock (not browser local). */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${bakuDateKey(d)}T${bakuTimeLabel(d)}`;
}

function fromDatetimeLocal(value: string): string | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (!m) return undefined;
  return parseBakuDateTime(m[1], m[2]).toISOString();
}

export default function AppointmentCreateModal({ open, onClose, onCreated, prefill }: Props) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientRefId, setPatientRefId] = useState("");
  const [practitionerCode, setPractitionerCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [serviceCode, setServiceCode] = useState("");
  const [visits, setVisits] = useState<VisitService[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientRefId("");
    setServiceCode("");
    setVisits(prefill?.visitServices ?? []);
    const fallback = prefill?.defaultDurationMinutes;
    setDurationMinutes(fallback && fallback >= 5 ? String(fallback) : "30");
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
  }, [open, prefill?.practitionerCode, prefill?.scheduledAtIso, prefill?.defaultDurationMinutes, prefill?.visitServices]);

  async function submit() {
    if (!patientRefId) {
      showApiError({ error: t("patientRequired") });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefId,
        practitionerCode,
        scheduledAt: scheduledAt ? fromDatetimeLocal(scheduledAt) : undefined,
        durationMinutes: Number(durationMinutes) || undefined,
        serviceCode: serviceCode || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showApiError(data, tc("failed"));
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
        <CatalogField
          kind="SEARCHABLE"
          label={t("visitService")}
          value={serviceCode}
          emptyLabel="—"
          options={visits.map((visit) => ({
            value: visit.code,
            label: `${visit.name} (${visit.code})`,
          }))}
          onChange={(next) => {
            const code = String(next ?? "");
            setServiceCode(code);
            const visit = visits.find((row) => row.code === code);
            if (visit) setDurationMinutes(String(visit.durationMin));
          }}
        />
        <Field
          label={t("durationMinutes")}
          preset="count"
          type="number"
          min={5}
          max={240}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
      </div>
      <ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel={busy ? "…" : tc("save")} />
    </ModalShell>
  );
}
