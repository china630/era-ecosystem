"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MODAL_FULL_CLASS, ModalShell } from "@era/satellite-kit/ui";
import { PatientCardBody, type PatientCardPatient } from "@/components/patients/PatientCardBody";

type Props = {
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  panel?: string | null;
  initialEpisodeId?: string | null;
  onCareTeamSize?: (episodeId: string, count: number) => void;
  /** When opened over another modal (e.g. walk-in party), pass a higher overlay z. */
  overlayZClass?: string;
};

export function PatientCardModal({
  patientId,
  open,
  onClose,
  panel,
  initialEpisodeId,
  onCareTeamSize,
  overlayZClass,
}: Props) {
  const t = useTranslations("patientRegistry");
  const [patient, setPatient] = useState<PatientCardPatient | null>(null);

  if (!patientId) return null;

  return (
    <ModalShell
      open={open}
      title={patient?.fullName ?? t("openCard")}
      onClose={onClose}
      maxWidthClass={`${MODAL_FULL_CLASS} !h-[90vh]`}
      overlayZClass={overlayZClass}
      bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
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
