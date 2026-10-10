"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PatientContraindicationsPanel } from "@/components/PatientContraindicationsPanel";
import { PatientCardClinicalSections } from "@/components/PatientCardClinicalSections";
import { PatientCardDiagnoses } from "@/components/patients/PatientCardDiagnoses";
import { PatientCardComplaints } from "@/components/patients/PatientCardComplaints";
import { PatientCardAnamnesis } from "@/components/patients/PatientCardAnamnesis";
import { day1ProgramToastKey } from "@/lib/day1-program-toast";
import { PatientCardCareTeam } from "@/components/patients/PatientCardCareTeam";
import { birthDateToInputValue } from "@/domain/patient/patient-demographics";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  Field,
  FieldRow,
  FieldSelect,
  ModalFooter,
  ModalShell,
  countryLabel,
  countryOptions,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import type { PractitionerAuthorRef } from "@/domain/staff/practitioner-label";

function identityValue(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "—";
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
  anamnesisByPractitioner?: PractitionerAuthorRef;
  programCode: string | null;
  roomNumber: string | null;
  patientOrigin: string;
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
  initialEpisodeId?: string | null;
  showBackLink?: boolean;
  onPatientLoaded?: (patient: PatientCardPatient) => void;
  onOpenDayPlan?: (episodeId: string) => void;
  /** Render only the procedure-plan modal. */
  planOnly?: boolean;
  onPlanClose?: () => void;
};

export function PatientCardBody({
  patientId,
  panel,
  initialEpisodeId,
  showBackLink = true,
  onPatientLoaded,
  onOpenDayPlan,
  planOnly = false,
  onPlanClose,
}: Props) {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const { auth } = useClinicAuth();
  const isSuperAdmin = Boolean(auth?.isPlatformSuperAdmin);
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [anamnesis, setAnamnesis] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [ciOpen, setCiOpen] = useState(false);
  const [ciCount, setCiCount] = useState(0);
  const [careTeamCount, setCareTeamCount] = useState(0);
  const [complaintCount, setComplaintCount] = useState(0);
  const [diagnosisCount, setDiagnosisCount] = useState(0);
  const [clinicalRefreshKey, setClinicalRefreshKey] = useState(0);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const locale = useLocale();
  const nationalityOptions = useMemo(
    () => countryOptions(locale, form.nationality),
    [locale, form.nationality],
  );
  const issuingCountryOptions = useMemo(
    () => countryOptions(locale, form.issuingCountry),
    [locale, form.issuingCountry],
  );

  const selectedEpisode = useMemo(
    () => episodes.find((e) => e.id === selectedEpisodeId) ?? null,
    [episodes, selectedEpisodeId],
  );

  async function retryPackageApply() {
    if (!selectedEpisodeId) return;
    const res = await fetch(`/api/sanatorium/episodes/${selectedEpisodeId}/package-apply`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc("saveFailed"));
      return;
    }
    showSuccess(t("retryPackageDone"));
    setClinicalRefreshKey((n) => n + 1);
  }

  const episodeReadOnly = selectedEpisode?.status !== "OPEN";
  const anamnesisOk = Boolean(anamnesis.trim());
  const careTeamOk = careTeamCount > 0;
  const studiesUnlocked = anamnesisOk && complaintCount > 0 && diagnosisCount > 0;
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
      const preferred = items.find((item) => item.id === initialEpisodeId) ?? items[0];
      setSelectedEpisodeId(preferred.id);
      setAnamnesis(preferred.anamnesisText ?? "");
    } else {
      setSelectedEpisodeId(null);
      setAnamnesis("");
    }
  }, [patientId, initialEpisodeId]);

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
    setCareTeamCount(0);
    setComplaintCount(0);
    setDiagnosisCount(0);
  }

  const onCareTeamChange = useCallback((items: { id: string }[]) => {
    setCareTeamCount((prev) => {
      if (prev === 0 && items.length > 0) {
        setClinicalRefreshKey((n) => n + 1);
      }
      return items.length;
    });
  }, []);

  function onAnamnesisSaved(payload: {
    anamnesisText: string | null;
    anamnesisByPractitioner: PractitionerAuthorRef;
    day1Program?: unknown;
  }) {
    if (!selectedEpisodeId) return;
    setAnamnesis(payload.anamnesisText ?? "");
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === selectedEpisodeId
          ? {
              ...e,
              anamnesisText: payload.anamnesisText,
              anamnesisByPractitioner: payload.anamnesisByPractitioner ?? e.anamnesisByPractitioner,
            }
          : e,
      ),
    );
    applyDay1Toast(payload.day1Program);
    setClinicalRefreshKey((n) => n + 1);
  }

  function applyDay1Toast(payload: unknown) {
    const key = day1ProgramToastKey(
      payload as Parameters<typeof day1ProgramToastKey>[0],
    );
    if (key) showSuccess(t(key));
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
      showApiError({ error: t("mdmNotFound") });
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
      showApiError(merged, tc("saveFailed"));
      return;
    }
    showSuccess(t("mergeFinSuccess"));
    await load();
  }

  async function savePatient() {
    if (!patient) return;
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
      showApiError(data, tc("saveFailed"));
      return;
    }
    setEditOpen(false);
    showSuccess(tc("saved"));
    await load();
  }

  if (planOnly) {
    if (!patient) return null;
    return (
      <PatientCardClinicalSections
        patientRefId={patient.id}
        panel="plan"
        episodeId={selectedEpisodeId}
        patientOrigin={selectedEpisode?.patientOrigin}
        readOnly={episodeReadOnly}
        anamnesisOk={anamnesisOk}
        studiesUnlocked={studiesUnlocked}
        refreshKey={clinicalRefreshKey}
        onOpenDayPlan={onOpenDayPlan}
        onPlanClose={onPlanClose}
      />
    );
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
            <div className="flex shrink-0 items-center gap-1">
              {isSuperAdmin && selectedEpisode?.status === "OPEN" ? (
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={t("retryPackageApply")}
                  title={t("retryPackageApply")}
                  onClick={() => void retryPackageApply()}
                >
                  <RefreshCw className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("edit")}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
              </button>
            </div>
          </div>
          {isSuperAdmin ? (
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("mdmBadge")}
              </span>
              {patient.globalPersonId ? (
                <span className={`text-base font-semibold ${TEXT_SUCCESS_CLASS}`}>
                  {maskPersonId(patient.globalPersonId)}
                </span>
              ) : (
                <span className={`text-base font-semibold ${TEXT_DANGER_CLASS}`}>
                  {t("mdmMissing")}
                </span>
              )}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("phone")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {identityValue(patient.phone)}
              </span>
            </p>
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("nationality")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {patient.nationality ? countryLabel(patient.nationality, locale) : "—"}
              </span>
            </p>
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("sex")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {identityValue(sexLabel(patient.sex))}
              </span>
            </p>
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("birthDate")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {birthDateToInputValue(patient.birthDate)
                  ? `${birthDateToInputValue(patient.birthDate)} (${ageLine})`
                  : "—"}
              </span>
            </p>
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("bloodGroup")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {patient.bloodGroup && patient.bloodGroup !== "UNKNOWN"
                  ? BLOOD_LABELS[patient.bloodGroup]
                  : "—"}
              </span>
            </p>
            <p>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("emergencyContact")}
              </span>
              <span className="text-base font-semibold text-[#2C3E50]">
                {identityValue(
                  [patient.emergencyContactName, patient.emergencyContactPhone]
                    .filter(Boolean)
                    .join(" · "),
                )}
              </span>
            </p>
          </div>
          {isSuperAdmin && patient.identifiersSummary && patient.identifiersSummary.length > 0 ? (
            <p className={TEXT_MUTED_CLASS}>
              {patient.identifiersSummary.map((i) => i.type).join(", ")}
            </p>
          ) : null}
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
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                {t("packageSummaryTitle")}
              </h2>
              <div className={`${CARD_CONTAINER_CLASS} space-y-1 p-4 text-sm`}>
                <p>
                  <span className="font-medium">{t("packageProgram")}:</span>{" "}
                  {selectedEpisode.programCode ?? "—"}
                </p>
                <p>
                  <span className="font-medium">{t("packageRoom")}:</span>{" "}
                  {selectedEpisode.roomNumber ?? "—"}
                </p>
                <p>
                  <span className="font-medium">{t("packageOrigin")}:</span>{" "}
                  {selectedEpisode.patientOrigin}
                </p>
              </div>
            </section>

            <PatientCardCareTeam
              episodeId={selectedEpisode.id}
              readOnly={episodeReadOnly}
              onTeamChange={onCareTeamChange}
            />
          </>
        ) : null}

        {selectedEpisode && (careTeamOk || episodeReadOnly) ? (
          <>
            <PatientCardAnamnesis
              episodeId={selectedEpisode.id}
              readOnly={episodeReadOnly}
              initialText={selectedEpisode.anamnesisText}
              initialAuthor={selectedEpisode.anamnesisByPractitioner ?? null}
              onSaved={onAnamnesisSaved}
            />

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
              onChanged={() => setClinicalRefreshKey((n) => n + 1)}
              onCountChange={setComplaintCount}
              onDay1Program={applyDay1Toast}
            />

            <PatientCardDiagnoses
              patientRefId={patient.id}
              episodeId={selectedEpisodeId}
              readOnly={episodeReadOnly}
              onCountChange={setDiagnosisCount}
              onDay1Program={(day1) => {
                applyDay1Toast(day1);
                setClinicalRefreshKey((n) => n + 1);
              }}
            />

            <PatientCardClinicalSections
              patientRefId={patient.id}
              panel={panel}
              episodeId={selectedEpisodeId}
              patientOrigin={selectedEpisode?.patientOrigin}
              readOnly={episodeReadOnly}
              anamnesisOk={anamnesisOk}
              studiesUnlocked={studiesUnlocked}
              refreshKey={clinicalRefreshKey}
              onOpenDayPlan={onOpenDayPlan}
            />
          </>
        ) : null}
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
              options={nationalityOptions}
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
                    options={issuingCountryOptions}
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
