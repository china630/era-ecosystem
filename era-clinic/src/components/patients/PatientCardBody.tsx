"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { PatientContraindicationsPanel } from "@/components/PatientContraindicationsPanel";
import { PatientCardClinicalSections } from "@/components/PatientCardClinicalSections";
import { PatientCardDiagnoses } from "@/components/patients/PatientCardDiagnoses";
import { PatientCardComplaints } from "@/components/patients/PatientCardComplaints";
import { birthDateToInputValue } from "@/domain/patient/patient-demographics";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  Field,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  NATIONALITY_OPTIONS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";

function nationalityLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const hit = NATIONALITY_OPTIONS.find((o) => o.value === code);
  return hit?.label ?? code;
}

export type PatientSex = "MALE" | "FEMALE" | "UNKNOWN";
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
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
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

type EpisodeOption = {
  id: string;
  label: string;
  status: string;
  anamnesisText: string | null;
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
  firstName: "",
  middleName: "",
  lastName: "",
  fullName: "",
  phone: "",
  nationality: "",
  sex: "UNKNOWN" as PatientSex,
  birthDate: "",
  bloodGroup: "UNKNOWN" as PatientBloodGroup,
  emergencyContactName: "",
  emergencyContactPhone: "",
  finCode: "",
  passportNumber: "",
  issuingCountry: "",
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
  const { auth } = useClinicAuth();
  const isSuperAdmin = Boolean(auth?.isPlatformSuperAdmin);
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [anamnesis, setAnamnesis] = useState("");
  const [anamnesisSaving, setAnamnesisSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [ciOpen, setCiOpen] = useState(false);
  const [ciCount, setCiCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedEpisode = useMemo(
    () => episodes.find((e) => e.id === selectedEpisodeId) ?? null,
    [episodes, selectedEpisodeId],
  );
  const episodeReadOnly = selectedEpisode?.status !== "OPEN";
  const anamnesisOk = Boolean(anamnesis.trim());
  const episodeFieldKind = episodes.length <= 12 ? "CLOSED_SMALL" : "SEARCHABLE";
  const episodeOptions = useMemo(
    () => episodes.map((e) => ({ value: e.id, label: e.label })),
    [episodes],
  );

  const sexLabel = useCallback(
    (sex: PatientSex | undefined) => {
      switch (sex) {
        case "MALE":
          return t("sexMale");
        case "FEMALE":
          return t("sexFemale");
        default:
          return t("sexUnknown");
      }
    },
    [t],
  );

  const loadEpisodes = useCallback(async () => {
    if (!patientId) return;
    const res = await fetch(`/api/patients/${patientId}/episodes`);
    if (!res.ok) return;
    const parsed = await res.json();
    const items = (parsed.data?.items ?? parsed.items ?? []) as EpisodeOption[];
    setEpisodes(items);
    if (items.length > 0) {
      setSelectedEpisodeId(items[0].id);
      setAnamnesis(items[0].anamnesisText ?? "");
    } else {
      setSelectedEpisodeId(null);
      setAnamnesis("");
    }
  }, [patientId]);

  const load = useCallback(async () => {
    if (!patientId) return;
    const res = await fetch(`/api/patients/${patientId}`);
    if (!res.ok) return;
    const parsed = await res.json();
    const p = (parsed.data ?? parsed) as PatientCardPatient;
    setPatient(p);
    onPatientLoaded?.(p);
    setForm({
      firstName: p.firstName ?? "",
      middleName: p.middleName ?? "",
      lastName: p.lastName ?? "",
      fullName: p.fullName ?? "",
      phone: p.phone ?? "",
      nationality: p.nationality ?? "",
      sex: p.sex ?? "UNKNOWN",
      birthDate: birthDateToInputValue(p.birthDate),
      bloodGroup: p.bloodGroup ?? "UNKNOWN",
      emergencyContactName: p.emergencyContactName ?? "",
      emergencyContactPhone: p.emergencyContactPhone ?? "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "",
    });
    await loadEpisodes();
  }, [patientId, onPatientLoaded, loadEpisodes]);

  useEffect(() => {
    void load();
  }, [load]);

  function onEpisodeChange(nextId: string) {
    setSelectedEpisodeId(nextId);
    const ep = episodes.find((e) => e.id === nextId);
    setAnamnesis(ep?.anamnesisText ?? "");
    setMsg(null);
  }

  async function saveAnamnesis() {
    if (!selectedEpisodeId || selectedEpisode?.status !== "OPEN") return;
    setAnamnesisSaving(true);
    setMsg(null);
    const trimmed = anamnesis.trim();
    const res = await fetch(`/api/sanatorium/episodes/${selectedEpisodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anamnesisText: trimmed }),
    });
    const data = await res.json();
    setAnamnesisSaving(false);
    if (!res.ok) {
      setMsg(data.error ?? data.message ?? tc("saveFailed"));
      return;
    }
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === selectedEpisodeId ? { ...e, anamnesisText: trimmed || null } : e,
      ),
    );
    setMsg(tc("saved"));
  }

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
    setMsg(null);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || null,
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
        {patient.globalPersonId &&
        patient.identifiersSummary?.some((i) => i.type === "PASSPORT") &&
        !patient.identifiersSummary?.some((i) => i.type === "AZ_FIN") &&
        isSuperAdmin ? (
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
        <div className={`${CARD_CONTAINER_CLASS} relative space-y-3 p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[#2C3E50]">{patient.fullName}</p>
              <p className="mt-0.5 text-sm font-medium text-[#34495E]">
                {patient.refCode}
                {patient.ageYears != null ? ` · ${t("ageYears", { age: patient.ageYears })}` : ""}
              </p>
            </div>
            <button
              type="button"
              className={TABLE_ROW_ICON_BTN_CLASS}
              aria-label={tc("edit")}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
            </button>
          </div>
          {isSuperAdmin ? (
            <p className="text-sm">
              {t("mdmBadge")}:{" "}
              {patient.globalPersonId ? (
                <span className={TEXT_SUCCESS_CLASS}>{maskPersonId(patient.globalPersonId)}</span>
              ) : (
                <span className={TEXT_DANGER_CLASS}>{t("mdmMissing")}</span>
              )}
            </p>
          ) : null}
          <div className="grid gap-2 text-sm text-[#2C3E50] sm:grid-cols-2">
            {patient.phone ? (
              <p>
                <span className="font-medium">{t("phone")}:</span> {patient.phone}
              </p>
            ) : null}
            <p>
              <span className="font-medium">{t("nationality")}:</span>{" "}
              {nationalityLabel(patient.nationality)}
            </p>
            <p>
              <span className="font-medium">{t("sex")}:</span> {sexLabel(patient.sex)}
            </p>
            <p>
              <span className="font-medium">{t("birthDate")}:</span>{" "}
              {birthDateToInputValue(patient.birthDate) || "—"} ({ageLine})
            </p>
            <p>
              <span className="font-medium">{t("bloodGroup")}:</span>{" "}
              {patient.bloodGroup && patient.bloodGroup !== "UNKNOWN"
                ? BLOOD_LABELS[patient.bloodGroup]
                : t("sexUnknown")}
            </p>
            {patient.emergencyContactName || patient.emergencyContactPhone ? (
              <p>
                <span className="font-medium">{t("emergencyContact")}:</span>{" "}
                {[patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          {isSuperAdmin && patient.identifiersSummary && patient.identifiersSummary.length > 0 ? (
            <p className={TEXT_MUTED_CLASS}>
              {patient.identifiersSummary.map((i) => i.type).join(", ")}
            </p>
          ) : null}
          {msg ? <p>{msg}</p> : null}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("episodeSelect")}
          </h2>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            {episodes.length > 0 ? (
              <CatalogField
                kind={episodeFieldKind}
                label={t("episodeSelect")}
                value={selectedEpisodeId ?? ""}
                onChange={(next) => onEpisodeChange(String(next))}
                options={episodeOptions}
              />
            ) : (
              <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("anamnesisCourseMissing")}</p>
            )}
          </div>
        </section>

        {selectedEpisode ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {t("anamnesis")}
            </h2>
            <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
              {selectedEpisode.status === "OPEN" ? (
                <>
                  <FieldTextarea
                    label={t("anamnesis")}
                    rows={4}
                    value={anamnesis}
                    onChange={(e) => setAnamnesis(e.target.value)}
                    placeholder={t("anamnesisHint")}
                  />
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={anamnesisSaving}
                    onClick={() => void saveAnamnesis()}
                  >
                    {t("anamnesisSave")}
                  </button>
                </>
              ) : (
                <>
                  <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("episodeClosedReadOnly")}</p>
                  <div className={`${SUBSECTION_SURFACE_CLASS} p-3`}>
                    <p className={`whitespace-pre-wrap ${TEXT_MUTED_CLASS}`}>
                      {anamnesis.trim() || "—"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <div
            className={`rounded-lg border-2 border-amber-400 bg-amber-50 shadow-sm ${
              ciOpen ? "p-4" : "px-4 py-2"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
                {t("contraindicationsTitle")}
                {ciCount > 0 ? (
                  <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                    {ciCount}
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                aria-expanded={ciOpen}
                onClick={() => setCiOpen((open) => !open)}
              >
                {ciOpen ? t("contraindicationsCollapse") : t("contraindicationsExpand")}
              </button>
            </div>
            <PatientContraindicationsPanel
              patientRefId={patient.id}
              episodeId={selectedEpisodeId}
              readOnly={episodeReadOnly}
              expanded={ciOpen}
              onCountChange={setCiCount}
            />
          </div>
        </section>

        <PatientCardComplaints
          patientRefId={patient.id}
          episodeId={selectedEpisodeId}
          readOnly={episodeReadOnly}
        />

        <PatientCardDiagnoses
          patientRefId={patient.id}
          episodeId={selectedEpisodeId}
          readOnly={episodeReadOnly}
        />

        <PatientCardClinicalSections
          patientRefId={patient.id}
          panel={panel}
          episodeId={selectedEpisodeId}
          readOnly={episodeReadOnly}
          anamnesisOk={anamnesisOk}
        />
      </div>

      <ModalShell open={editOpen} title={t("editPatient")} onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("demographicsHint")}</p>
          <FieldRow cols={3}>
            <Field
              label={t("firstName")}
              preset="shortText"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Field
              label={t("lastName")}
              preset="shortText"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
            <Field
              label={t("middleName")}
              preset="shortText"
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t("phone")}
              preset="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t("nationality")}
              value={form.nationality}
              onChange={(v) =>
                setForm({ ...form, nationality: String(v ?? "").toUpperCase() })
              }
              options={[...NATIONALITY_OPTIONS]}
              emptyLabel={t("sexUnknown")}
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
            <option value="UNKNOWN">{t("sexUnknown")}</option>
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
          {isSuperAdmin ? (
            <>
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
                {form.passportNumber.trim() ? (
                  <CatalogField
                    kind="SEARCHABLE"
                    label={t("issuingCountryPassport")}
                    value={form.issuingCountry}
                    onChange={(v) =>
                      setForm({ ...form, issuingCountry: String(v ?? "").toUpperCase() })
                    }
                    options={[...NATIONALITY_OPTIONS]}
                    emptyLabel={t("sexUnknown")}
                  />
                ) : (
                  <div />
                )}
              </FieldRow>
            </>
          ) : (
            <Field
              label={t("finCode")}
              preset="fin"
              value={form.finCode}
              onChange={(e) => setForm({ ...form, finCode: e.target.value.toUpperCase() })}
            />
          )}
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
