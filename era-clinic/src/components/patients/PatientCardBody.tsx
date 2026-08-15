"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PatientContraindicationsPanel } from "@/components/PatientContraindicationsPanel";
import { PatientCardClinicalSections } from "@/components/PatientCardClinicalSections";
import { birthDateToInputValue } from "@/domain/patient/patient-demographics";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  Field,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from "@era/satellite-kit/ui";

export type PatientSex = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type PatientBloodGroup =
  | "A_POS"
  | "A_NEG"
  | "B_POS"
  | "B_NEG"
  | "AB_POS"
  | "AB_NEG"
  | "O_POS"
  | "O_NEG"
  | "UNKNOWN";

export type PatientCardPatient = {
  id: string;
  refCode: string;
  fullName: string;
  phone?: string | null;
  nationality?: string | null;
  sex?: PatientSex;
  birthDate?: string | null;
  ageYears?: number | null;
  bloodGroup?: PatientBloodGroup;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  globalPersonId?: string | null;
  anamnesisText?: string | null;
  identifiersSummary?: Array<{ type: string; issuingCountry: string | null; isPrimary: boolean }>;
};

const BLOOD_LABELS: Record<PatientBloodGroup, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
  UNKNOWN: "—",
};

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const emptyForm = {
  fullName: "",
  phone: "",
  nationality: "AZ",
  sex: "UNKNOWN" as PatientSex,
  birthDate: "",
  bloodGroup: "UNKNOWN" as PatientBloodGroup,
  emergencyContactName: "",
  emergencyContactPhone: "",
  finCode: "",
  passportNumber: "",
  issuingCountry: "AZ",
  anamnesisText: "",
};

type Props = {
  patientId: string;
  panel?: string | null;
  showBackLink?: boolean;
  onPatientLoaded?: (patient: PatientCardPatient) => void;
};

export function PatientCardBody({
  patientId,
  panel,
  showBackLink = true,
  onPatientLoaded,
}: Props) {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sexLabel = useCallback(
    (sex: PatientSex | undefined) => {
      switch (sex) {
        case "MALE":
          return t("sexMale");
        case "FEMALE":
          return t("sexFemale");
        case "OTHER":
          return t("sexOther");
        default:
          return t("sexUnknown");
      }
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!patientId) return;
    const res = await fetch(`/api/patients/${patientId}`);
    if (!res.ok) return;
    const parsed = await res.json();
    const p = (parsed.data ?? parsed) as PatientCardPatient;
    setPatient(p);
    onPatientLoaded?.(p);
    setForm({
      fullName: p.fullName ?? "",
      phone: p.phone ?? "",
      nationality: p.nationality ?? "AZ",
      sex: p.sex ?? "UNKNOWN",
      birthDate: birthDateToInputValue(p.birthDate),
      bloodGroup: p.bloodGroup ?? "UNKNOWN",
      emergencyContactName: p.emergencyContactName ?? "",
      emergencyContactPhone: p.emergencyContactPhone ?? "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "AZ",
      anamnesisText: p.anamnesisText ?? "",
    });
  }, [patientId, onPatientLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lookupMdm() {
    if (!form.fullName.trim()) {
      setMdmStatus(t("nameRequired"));
      return;
    }
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fin: form.finCode.trim() || undefined,
        passport: form.passportNumber.trim() || undefined,
        issuingCountry: form.issuingCountry.trim() || undefined,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      setMdmStatus(t("mdmLinked", { id: maskPersonId(data.globalPersonId) }));
    } else {
      setMdmStatus(t("mdmNotFound"));
    }
  }

  async function mergeFinObtained() {
    if (!patient?.globalPersonId) return;
    const fin = window.prompt(t("mergeFinPrompt"));
    if (!fin?.trim()) return;
    const targetFin = fin.trim().toUpperCase();
    const lookupRes = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fin: targetFin, fullName: patient.fullName }),
    });
    const lookup = await lookupRes.json();
    if (!lookup.globalPersonId) {
      setMsg(t("mdmNotFound"));
      return;
    }
    const mergeRes = await fetch("/api/mdm/person-merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefId: patient.id,
        sourcePersonId: patient.globalPersonId,
        targetPersonId: lookup.globalPersonId,
        fin: targetFin,
        fullName: patient.fullName,
      }),
    });
    const merged = await mergeRes.json();
    if (!mergeRes.ok) {
      setMsg(merged.error ?? tc("saveFailed"));
      return;
    }
    setMsg(t("mergeFinSuccess"));
    await load();
  }

  async function savePatient() {
    if (!patient) return;
    if (!form.anamnesisText.trim()) {
      setMsg(t("anamnesisRequired"));
      return;
    }
    setMsg(null);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        phone: form.phone || null,
        nationality: form.nationality.trim() || null,
        sex: form.sex,
        birthDate: form.birthDate.trim() || null,
        bloodGroup: form.bloodGroup,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        finCode: form.finCode.trim() || null,
        passportNumber: form.passportNumber.trim() || null,
        issuingCountry: form.issuingCountry.trim() || null,
        anamnesisText: form.anamnesisText.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? data.message ?? tc("saveFailed"));
      return;
    }
    setEditOpen(false);
    setMsg(tc("saved"));
    await load();
  }

  if (!patient) {
    return <p className={`p-6 text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  const ageLine =
    patient.ageYears != null ? t("ageYears", { age: patient.ageYears }) : t("ageUnknown");

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setEditOpen(true)}>
          {tc("edit")}
        </button>
        {patient.globalPersonId &&
        patient.identifiersSummary?.some((i) => i.type === "PASSPORT") &&
        !patient.identifiersSummary?.some((i) => i.type === "AZ_FIN") ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void mergeFinObtained()}>
            {t("finObtained")}
          </button>
        ) : null}
        {showBackLink ? (
          <Link href="/patients" className={SECONDARY_BUTTON_CLASS}>
            {t("backToList")}
          </Link>
        ) : null}
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-10 sm:px-0">
        <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-[13px]`}>
          <p>
            {t("mdmBadge")}:{" "}
            {patient.globalPersonId ? (
              <span className={TEXT_SUCCESS_CLASS}>{maskPersonId(patient.globalPersonId)}</span>
            ) : (
              <span className={TEXT_DANGER_CLASS}>{t("mdmMissing")}</span>
            )}
          </p>
          <div className={`grid gap-1 ${TEXT_MUTED_CLASS} sm:grid-cols-2`}>
            {patient.phone ? (
              <p>
                {t("phone")}: {patient.phone}
              </p>
            ) : null}
            {patient.nationality ? (
              <p>
                {t("nationality")}: {patient.nationality}
              </p>
            ) : null}
            <p>
              {t("sex")}: {sexLabel(patient.sex)}
            </p>
            <p>
              {t("birthDate")}: {birthDateToInputValue(patient.birthDate) || "—"} ({ageLine})
            </p>
            <p>
              {t("bloodGroup")}:{" "}
              {patient.bloodGroup && patient.bloodGroup !== "UNKNOWN"
                ? BLOOD_LABELS[patient.bloodGroup]
                : t("bloodUnknown")}
            </p>
            {patient.emergencyContactName || patient.emergencyContactPhone ? (
              <p>
                {t("emergencyContact")}:{" "}
                {[patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          {patient.anamnesisText ? (
            <div className={`${SUBSECTION_SURFACE_CLASS} p-3`}>
              <p className="mb-1 font-semibold">{t("anamnesis")}</p>
              <p className={`whitespace-pre-wrap ${TEXT_MUTED_CLASS}`}>{patient.anamnesisText}</p>
            </div>
          ) : (
            <p className="text-amber-700">{t("anamnesisMissing")}</p>
          )}
          {patient.identifiersSummary && patient.identifiersSummary.length > 0 ? (
            <p className={TEXT_MUTED_CLASS}>
              {patient.identifiersSummary.map((i) => i.type).join(", ")}
            </p>
          ) : null}
          {msg ? <p>{msg}</p> : null}
        </div>

        <section className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
            {t("contraindicationsTitle")}
          </h2>
          <PatientContraindicationsPanel patientRefId={patient.id} />
        </section>

        <PatientCardClinicalSections patientRefId={patient.id} panel={panel} />
      </div>

      <ModalShell open={editOpen} title={t("editPatient")} onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("demographicsHint")}</p>
          <FieldTextarea
            label={t("anamnesis")}
            required
            rows={4}
            value={form.anamnesisText}
            onChange={(e) => setForm({ ...form, anamnesisText: e.target.value })}
            placeholder={t("anamnesisHint")}
          />
          <Field
            label={t("fullName")}
            preset="shortText"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <FieldRow cols={2}>
            <Field
              label={t("phone")}
              preset="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Field
              label={t("nationality")}
              preset="code"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <FieldSelect
              label={t("sex")}
              preset="shortText"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as PatientSex })}
            >
              <option value="UNKNOWN">{t("sexUnknown")}</option>
              <option value="MALE">{t("sexMale")}</option>
              <option value="FEMALE">{t("sexFemale")}</option>
              <option value="OTHER">{t("sexOther")}</option>
            </FieldSelect>
            <DatePicker
              label={t("birthDate")}
              value={form.birthDate}
              onChange={(isoDate) => setForm({ ...form, birthDate: isoDate })}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          </FieldRow>
          <FieldSelect
            label={t("bloodGroup")}
            preset="shortText"
            value={form.bloodGroup}
            onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as PatientBloodGroup })}
          >
            <option value="UNKNOWN">{t("bloodUnknown")}</option>
            {(Object.keys(BLOOD_LABELS) as PatientBloodGroup[])
              .filter((k) => k !== "UNKNOWN")
              .map((k) => (
                <option key={k} value={k}>
                  {BLOOD_LABELS[k]}
                </option>
              ))}
          </FieldSelect>
          <FieldRow cols={2}>
            <Field
              label={t("emergencyContactName")}
              preset="shortText"
              value={form.emergencyContactName}
              onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
            />
            <Field
              label={t("emergencyContactPhone")}
              preset="phone"
              value={form.emergencyContactPhone}
              onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
            />
          </FieldRow>
          <FieldRow cols={2} className="items-end">
            <Field
              label={t("finCode")}
              preset="fin"
              value={form.finCode}
              onChange={(e) => setForm({ ...form, finCode: e.target.value.toUpperCase() })}
            />
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} self-end`}
              onClick={() => void lookupMdm()}
            >
              {t("mdmLookup")}
            </button>
          </FieldRow>
          {mdmStatus ? <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{mdmStatus}</p> : null}
          <FieldRow cols={2}>
            <Field
              label={t("passportNumber")}
              preset="code"
              value={form.passportNumber}
              onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
            />
            <Field
              label={t("issuingCountry")}
              preset="code"
              value={form.issuingCountry}
              onChange={(e) => setForm({ ...form, issuingCountry: e.target.value.toUpperCase() })}
            />
          </FieldRow>
        </div>
        <ModalFooter
          onCancel={() => setEditOpen(false)}
          onSubmit={() => void savePatient()}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </>
  );
}

export { maskPersonId, BLOOD_LABELS };
