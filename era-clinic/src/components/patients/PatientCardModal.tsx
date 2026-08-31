"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@era/satellite-kit/ui";
import { PatientCardBody, type PatientCardPatient } from "@/components/patients/PatientCardBody";

type Props = {
  patientId: string | null;
  open: boolean;
  onClose: () => void;
};

export function PatientCardModal({ patientId, open, onClose }: Props) {
  const t = useTranslations("patientRegistry");
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);

  if (!patientId) return null;

  return (
    <ModalShell
      open={open}
      title={patient?.fullName ?? t("openCard")}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
    >
      <PatientCardBody
        patientId={patientId}
        showBackLink={false}
        onPatientLoaded={setPatient}
      />
    </ModalShell>
  );
}
