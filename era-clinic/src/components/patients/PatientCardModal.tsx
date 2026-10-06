"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@era/satellite-kit/ui";
import { PatientCardBody, type PatientCardPatient } from "@/components/patients/PatientCardBody";

type Props = {
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  panel?: string | null;
  initialEpisodeId?: string | null;
  onOpenDayPlan?: (episodeId: string) => void;
};

export function PatientCardModal({
  patientId,
  open,
  onClose,
  panel,
  initialEpisodeId,
  onOpenDayPlan,
}: Props) {
  const t = useTranslations("patientRegistry");
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);

  if (!patientId) return null;

  return (
    <ModalShell
      open={open}
      title={patient?.fullName ?? t("openCard")}
      onClose={onClose}
      maxWidthClass="max-w-4xl w-full max-h-[90vh]"
    >
      <PatientCardBody
        patientId={patientId}
        showBackLink={false}
        onPatientLoaded={setPatient}
        panel={panel}
        initialEpisodeId={initialEpisodeId}
        onOpenDayPlan={onOpenDayPlan}
      />
    </ModalShell>
  );
}
