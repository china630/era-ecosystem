"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  EraDataGrid,
  FieldSelect,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  type EraDataGridColumn,
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
  const [expandedWardId, setExpandedWardId] = useState<string | null>(null);
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
        fetch("/api/patients?pageSize=100"),
      ]);
      const inpatientJson = await inpatientRes.json();
      const patientsJson = await patientsRes.json();
      const rows = (inpatientJson.data?.wards ?? inpatientJson.wards ?? []) as Ward[];
      setWards(Array.isArray(rows) ? rows : []);
      const patientPayload = patientsJson.data ?? patientsJson;
      setPatients(patientPayload.items ?? patientPayload ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function wardCounts(ward: Ward) {
    const occupied = ward.beds.filter((b) => b.assignments.length > 0).length;
    const free = ward.beds.length - occupied;
    return { occupied, free, total: ward.beds.length };
  }

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
          <div className="flex flex-wrap gap-2">
            <Link href="/inpatient/census" className={SECONDARY_BUTTON_CLASS}>
              {t("censusLink")}
            </Link>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => openAssign()}>
              {t("assignBed")}
            </button>
          </div>
        }
      />

      {msg ? <p className="mb-4 text-[13px]">{msg}</p> : null}

      {loading ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
      ) : wards.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-6 text-[13px] ${TEXT_MUTED_CLASS}`}>
          {t("empty")} {t("configureWardsHint")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wards.map((ward) => {
            const { occupied, free, total } = wardCounts(ward);
            const expanded = expandedWardId === ward.id;
            return (
              <section key={ward.id} className={`${CARD_CONTAINER_CLASS} p-4`}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedWardId(expanded ? null : ward.id)}
                >
                  <header className="mb-2">
                    <h2 className="text-sm font-semibold">{ward.name}</h2>
                    <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{ward.code}</p>
                    <p className="mt-2 text-[13px]">
                      {t("bedsOccupied")}: {occupied} · {t("bedsFree")}: {free} / {total}
                    </p>
                  </header>
                </button>
                {expanded ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ward.beds.map((bed) => {
                      const active = bed.assignments[0];
                      const occupiedBed = Boolean(active);
                      return (
                        <div
                          key={bed.id}
                          className={`rounded border p-3 text-[13px] ${
                            occupiedBed
                              ? "border-amber-300 bg-amber-50"
                              : "border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <div className="font-medium">{bed.code}</div>
                          <div className={`text-xs ${TEXT_MUTED_CLASS}`}>{bed.status}</div>
                          {occupiedBed && active ? (
                            <div className="mt-2 space-y-1">
                              <div className="font-medium">
                                {active.patient?.fullName ?? active.patientRefId}
                              </div>
                              {active.patient?.refCode ? (
                                <div className={`text-xs ${TEXT_MUTED_CLASS}`}>{active.patient.refCode}</div>
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
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <ModalShell open={assignOpen} title={t("assignBed")} onClose={() => setAssignOpen(false)}>
        <div className="space-y-3 text-[13px]">
          <FieldSelect
            label={t("selectBed")}
            preset="selectWide"
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
          </FieldSelect>
          <FieldSelect
            label={t("selectPatient")}
            preset="selectWide"
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
          </FieldSelect>
        </div>
        <ModalFooter
          onCancel={() => setAssignOpen(false)}
          onSubmit={() => void submitAssign()}
          submitLabel={t("assign")}
        />
      </ModalShell>

      <ModalShell open={transferOpen} title={t("transfer")} onClose={() => setTransferOpen(false)}>
        <p className="mb-2 text-[13px]">{transferForm.patientName}</p>
        <FieldSelect
          label={t("selectBed")}
          preset="selectWide"
          value={transferForm.newBedId}
          onChange={(e) => setTransferForm({ ...transferForm, newBedId: e.target.value })}
        >
          <option value="">{t("selectBed")}</option>
          {availableBeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </FieldSelect>
        <ModalFooter
          onCancel={() => setTransferOpen(false)}
          onSubmit={() => void submitTransfer()}
          submitLabel={t("transfer")}
        />
      </ModalShell>
    </>
  );
}
