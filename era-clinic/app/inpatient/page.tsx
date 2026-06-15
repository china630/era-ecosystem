"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type PatientSummary = {
  id: string;
  refCode: string;
  fullName: string;
};

type BedAssignment = {
  id: string;
  patientRefId: string;
  admissionId: string | null;
  admittedAt: string;
  patient: PatientSummary | null;
};

type Bed = {
  id: string;
  code: string;
  status: string;
  assignments: BedAssignment[];
};

type Ward = {
  id: string;
  code: string;
  name: string;
  beds: Bed[];
};

export default function InpatientPage() {
  const t = useTranslations("inpatient");
  const tc = useTranslations("common");
  const [wards, setWards] = useState<Ward[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ bedId: "", patientRefId: "" });
  const [transferForm, setTransferForm] = useState({
    admissionId: "",
    newBedId: "",
    patientName: "",
  });

  const availableBeds = useMemo(() => {
    const rows: Array<{ id: string; label: string }> = [];
    for (const ward of wards) {
      for (const bed of ward.beds) {
        if (bed.status === "AVAILABLE" && bed.assignments.length === 0) {
          rows.push({ id: bed.id, label: `${ward.code} / ${bed.code}` });
        }
      }
    }
    return rows;
  }, [wards]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inpatientRes, patientsRes] = await Promise.all([
        fetch("/api/inpatient"),
        fetch("/api/patients"),
      ]);
      const inpatientJson = await inpatientRes.json();
      const patientsJson = await patientsRes.json();
      const rows = (inpatientJson.data?.wards ?? inpatientJson.wards ?? []) as Ward[];
      setWards(Array.isArray(rows) ? rows : []);
      setPatients((patientsJson.data ?? patientsJson) as PatientSummary[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAssign(bedId?: string) {
    setAssignForm({ bedId: bedId ?? "", patientRefId: "" });
    setAssignOpen(true);
  }

  function openTransfer(assignment: BedAssignment, patientName: string) {
    if (!assignment.admissionId) return;
    setTransferForm({
      admissionId: assignment.admissionId,
      newBedId: "",
      patientName,
    });
    setTransferOpen(true);
  }

  async function submitAssign() {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admit",
        bedId: assignForm.bedId,
        patientRefId: assignForm.patientRefId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? tc("failed"));
      return;
    }
    setAssignOpen(false);
    setMsg(t("assigned"));
    await load();
  }

  async function submitTransfer() {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        admissionId: transferForm.admissionId,
        newBedId: transferForm.newBedId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? tc("failed"));
      return;
    }
    setTransferOpen(false);
    setMsg(t("transferred"));
    await load();
  }

  async function discharge(admissionId: string) {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discharge", admissionId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? tc("failed"));
      return;
    }
    setMsg(t("discharged"));
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => openAssign()}>
            {t("assignBed")}
          </button>
        }
      />

      {msg ? <p className="mb-4 text-[13px] text-[#2C3E50]">{msg}</p> : null}

      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
      ) : wards.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-6 text-[13px] text-[#7F8C8D]`}>
          {t("empty")} {t("configureWardsHint")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {wards.map((ward) => (
            <section key={ward.id} className={`${CARD_CONTAINER_CLASS} p-4`}>
              <header className="mb-3">
                <h2 className="text-sm font-semibold">{ward.name}</h2>
                <p className="text-xs text-[#7F8C8D]">{ward.code}</p>
              </header>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ward.beds.map((bed) => {
                  const active = bed.assignments[0];
                  const occupied = Boolean(active);
                  return (
                    <div
                      key={bed.id}
                      className={`rounded border p-3 text-[13px] ${
                        occupied
                          ? "border-amber-300 bg-amber-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <div className="font-medium">{bed.code}</div>
                      <div className="text-xs text-[#7F8C8D]">{bed.status}</div>
                      {occupied && active ? (
                        <div className="mt-2 space-y-1">
                          <div className="font-medium">
                            {active.patient?.fullName ?? active.patientRefId}
                          </div>
                          {active.patient?.refCode ? (
                            <div className="text-xs text-[#7F8C8D]">{active.patient.refCode}</div>
                          ) : null}
                          <button
                            type="button"
                            className={`mt-1 w-full ${SECONDARY_BUTTON_CLASS}`}
                            onClick={() =>
                              openTransfer(
                                active,
                                active.patient?.fullName ?? active.patientRefId,
                              )
                            }
                          >
                            {t("transfer")}
                          </button>
                          {active.admissionId ? (
                            <button
                              type="button"
                              className={`mt-1 w-full ${SECONDARY_BUTTON_CLASS}`}
                              onClick={() => void discharge(active.admissionId!)}
                            >
                              {t("discharge")}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`mt-2 w-full ${PRIMARY_BUTTON_CLASS}`}
                          onClick={() => openAssign(bed.id)}
                        >
                          {t("assign")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <ModalShell open={assignOpen} title={t("assignBed")} onClose={() => setAssignOpen(false)}>
        <div className="space-y-3 text-[13px]">
          <label className="block">
            {t("selectBed")}
            <select
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={assignForm.bedId}
              onChange={(e) => setAssignForm({ ...assignForm, bedId: e.target.value })}
              required
            >
              <option value="">{t("selectBed")}</option>
              {availableBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {t("selectPatient")}
            <select
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={assignForm.patientRefId}
              onChange={(e) => setAssignForm({ ...assignForm, patientRefId: e.target.value })}
              required
            >
              <option value="">{t("selectPatient")}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.refCode} — {p.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ModalFooter
          onCancel={() => setAssignOpen(false)}
          onSubmit={() => void submitAssign()}
          submitLabel={t("assign")}
        />
      </ModalShell>

      <ModalShell open={transferOpen} title={t("transfer")} onClose={() => setTransferOpen(false)}>
        <p className="mb-2 text-[13px]">{transferForm.patientName}</p>
        <label className="block text-[13px]">
          {t("selectBed")}
          <select
            className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
            value={transferForm.newBedId}
            onChange={(e) => setTransferForm({ ...transferForm, newBedId: e.target.value })}
          >
            <option value="">{t("selectBed")}</option>
            {availableBeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <ModalFooter
          onCancel={() => setTransferOpen(false)}
          onSubmit={() => void submitTransfer()}
          submitLabel={t("transfer")}
        />
      </ModalShell>
    </>
  );
}
