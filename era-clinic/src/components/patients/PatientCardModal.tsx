"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@era/satellite-kit/ui";
import { PatientCardBody, type PatientCardPatient } from "@/components/patients/PatientCardBody";
import { EPISODE_MODAL_CLASS } from "@/components/sanatorium/episode-modal-class";

type Props = {
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  panel?: string | null;
  initialEpisodeId?: string | null;
  onCareTeamSize?: (episodeId: string, count: number) => void;
};

export function PatientCardModal({
  patientId,
  open,
  onClose,
  panel,
  initialEpisodeId,
  onCareTeamSize,
}: Props) {
  const t = useTranslations("patientRegistry");
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);

  if (!patientId) return null;

  return (
    <ModalShell
      open={open}
      title={patient?.fullName ?? t("openCard")}
      onClose={onClose}
      maxWidthClass={EPISODE_MODAL_CLASS}
    >
      <PatientCardBody
        patientId={patientId}
        showBackLink={false}
        onPatientLoaded={setPatient}
        panel={panel}
        initialEpisodeId={initialEpisodeId}
        onCareTeamSize={onCareTeamSize}
      />
    </ModalShell>
  );
}
