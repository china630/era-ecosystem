"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    wardCode: "",
    bedCode: "",
    patientRefId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inpatient");
      const json = await res.json();
      const rows = (json.data?.wards ?? json.wards ?? []) as Ward[];
      setWards(Array.isArray(rows) ? rows : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAssign(wardCode?: string, bedCode?: string) {
    setAssignForm({
      wardCode: wardCode ?? "",
      bedCode: bedCode ?? "",
      patientRefId: "",
    });
    setAssignOpen(true);
  }

  async function submitAssign() {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignForm),
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

  async function discharge(assignmentId: string) {
    setMsg(null);
    const res = await fetch(`/api/inpatient/assignments/${assignmentId}`, {
      method: "PATCH",
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
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {wards.map((ward) => (
            <section key={ward.id} className={`${CARD_CONTAINER_CLASS} p-4`}>
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{ward.name}</h2>
                  <p className="text-xs text-[#7F8C8D]">{ward.code}</p>
                </div>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => openAssign(ward.code)}
                >
                  {t("addBed")}
                </button>
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
                            onClick={() => void discharge(active.id)}
                          >
                            {t("discharge")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`mt-2 w-full ${PRIMARY_BUTTON_CLASS}`}
                          onClick={() => openAssign(ward.code, bed.code)}
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
            {t("wardCode")}
            <input
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={assignForm.wardCode}
              onChange={(e) => setAssignForm({ ...assignForm, wardCode: e.target.value })}
              required
            />
          </label>
          <label className="block">
            {t("bedCode")}
            <input
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={assignForm.bedCode}
              onChange={(e) => setAssignForm({ ...assignForm, bedCode: e.target.value })}
              required
            />
          </label>
          <label className="block">
            {t("patientRefId")}
            <input
              className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
              value={assignForm.patientRefId}
              onChange={(e) => setAssignForm({ ...assignForm, patientRefId: e.target.value })}
              required
            />
          </label>
        </div>
        <ModalFooter
          onCancel={() => setAssignOpen(false)}
          onSubmit={() => void submitAssign()}
          submitLabel={t("assign")}
        />
      </ModalShell>
    </>
  );
}
