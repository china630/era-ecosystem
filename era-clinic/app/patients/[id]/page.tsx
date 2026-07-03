"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PatientContraindicationsPanel } from "@/components/PatientContraindicationsPanel";
import {
  Field,
  FieldRow,
  FieldSelect,
  ModalFooter,
  ModalShell,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Patient = {
  id: string;
  refCode: string;
  fullName: string;
  phone?: string | null;
  globalPersonId?: string | null;
  identifiersSummary?: Array<{ type: string; issuingCountry: string | null; isPrimary: boolean }>;
};

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default function PatientCardPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    finCode: "",
    passportNumber: "",
    issuingCountry: "AZ",
  });

  const load = useCallback(async () => {
    if (!params.id) return;
    const res = await fetch(`/api/patients/${params.id}`);
    if (!res.ok) return;
    const parsed = await res.json();
    const p = (parsed.data ?? parsed) as Patient;
    setPatient(p);
    setForm({
      fullName: p.fullName ?? "",
      phone: p.phone ?? "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "AZ",
    });
  }, [params.id]);

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
    setMsg(null);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        phone: form.phone || null,
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
    return <p className="p-6 text-sm text-slate-500">{tc("loading")}</p>;
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <Link href="/patients" className="text-sm text-blue-600 hover:underline">
        ← {t("backToList")}
      </Link>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{patient.fullName ?? patient.refCode}</h1>
          <p className="text-sm text-slate-500">{patient.refCode}</p>
          <p className="mt-1 text-xs">
            {t("mdmBadge")}:{" "}
            {patient.globalPersonId ? (
              <span className="text-green-700">{maskPersonId(patient.globalPersonId)}</span>
            ) : (
              <span className="text-red-600">{t("mdmMissing")}</span>
            )}
          </p>
          {patient.identifiersSummary && patient.identifiersSummary.length > 0 ? (
            <p className="text-xs text-slate-500">
              {patient.identifiersSummary.map((i) => i.type).join(", ")}
            </p>
          ) : null}
        </div>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditOpen(true)}>
          {tc("edit")}
        </button>
        {patient.globalPersonId &&
        patient.identifiersSummary?.some((i) => i.type === "PASSPORT") &&
        !patient.identifiersSummary?.some((i) => i.type === "AZ_FIN") ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void mergeFinObtained()}>
            {t("finObtained")}
          </button>
        ) : null}
      </header>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("contraindicationsTitle")}
        </h2>
        <PatientContraindicationsPanel patientRefId={patient.id} />
      </section>

      <ModalShell open={editOpen} title={t("editPatient")} onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <Field
            label={t("fullName")}
            preset="shortText"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Field
            label={t("phone")}
            preset="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
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
        </div>
        <ModalFooter onCancel={() => setEditOpen(false)} onSubmit={() => void savePatient()} submitLabel={tc("save")} />
      </ModalShell>
    </main>
  );
}
