"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type PatientSex = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
type PatientBloodGroup =
  | "A_POS"
  | "A_NEG"
  | "B_POS"
  | "B_NEG"
  | "AB_POS"
  | "AB_NEG"
  | "O_POS"
  | "O_NEG"
  | "UNKNOWN";

type Patient = {
  id: string;
  refCode: string;
  fullName: string;
  phone?: string | null;
  sex?: PatientSex;
  ageYears?: number | null;
  globalPersonId?: string | null;
};

const BLOOD_OPTIONS: { value: PatientBloodGroup; label: string }[] = [
  { value: "UNKNOWN", label: "—" },
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
];

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const emptyForm = {
  refCode: "",
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
};

export default function PatientsPage() {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/patients${params}`);
    const d = await res.json();
    setRows((d.data ?? d) as Patient[]);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lookupMdm() {
    setMdmStatus(null);
    if (!form.finCode.trim()) {
      setMdmStatus(t("finRequired"));
      return;
    }
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fin: form.finCode.trim() }),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      setMdmStatus(t("mdmLinked", { id: maskPersonId(data.globalPersonId) }));
      if (data.fullName && !form.fullName) {
        setForm((f) => ({ ...f, fullName: data.fullName }));
      }
    } else {
      setMdmStatus(t("mdmNotFound"));
    }
  }

  async function save() {
    setError(null);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        birthDate: form.birthDate.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("saveFailed"));
      return;
    }
    setOpen(false);
    setForm(emptyForm);
    setMdmStatus(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
            {tc("add")}
          </button>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <input
          className={MODAL_INPUT_CLASS}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b text-[#7F8C8D]">
              <th className="p-2">{t("refCode")}</th>
              <th className="p-2">{t("name")}</th>
              <th className="p-2">{t("sex")}</th>
              <th className="p-2">{t("birthDate")}</th>
              <th className="p-2">{t("phone")}</th>
              <th className="p-2">{t("mdmBadge")}</th>
              <th className="p-2">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.refCode}</td>
                <td className="p-2">{p.fullName}</td>
                <td className="p-2">
                  {p.sex === "MALE"
                    ? t("sexMale")
                    : p.sex === "FEMALE"
                      ? t("sexFemale")
                      : p.sex === "OTHER"
                        ? t("sexOther")
                        : "—"}
                </td>
                <td className="p-2">
                  {p.ageYears != null ? t("ageYears", { age: p.ageYears }) : "—"}
                </td>
                <td className="p-2">{p.phone ?? "—"}</td>
                <td className="p-2">
                  {p.globalPersonId ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs">
                      {maskPersonId(p.globalPersonId)}
                    </span>
                  ) : (
                    <span className="text-red-600">{t("mdmMissing")}</span>
                  )}
                </td>
                <td className="p-2">
                  <Link href={`/patients/${p.id}`} className="text-[#2980B9] hover:underline">
                    {t("openCard")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModalShell open={open} title={t("createTitle")} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <p className="text-xs text-[#7F8C8D]">{t("demographicsHint")}</p>
          <Field
            label={t("refCode")}
            preset="code"
            value={form.refCode}
            onChange={(e) => setForm({ ...form, refCode: e.target.value })}
          />
          <Field
            label={t("name")}
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
            <Field
              label={t("birthDate")}
              preset="shortText"
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </FieldRow>
          <FieldSelect
            label={t("bloodGroup")}
            preset="shortText"
            value={form.bloodGroup}
            onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as PatientBloodGroup })}
          >
            {BLOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === "UNKNOWN" ? t("bloodUnknown") : o.label}
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
            <button type="button" className={`${SECONDARY_BUTTON_CLASS} self-end`} onClick={() => void lookupMdm()}>
              {t("mdmLookup")}
            </button>
          </FieldRow>
          {mdmStatus ? <p className="text-xs text-[#7F8C8D]">{mdmStatus}</p> : null}
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
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </>
  );
}
