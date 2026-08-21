/** Pure patient / clinical-card gates (AC-CLI-PT). */

export function patientCreateDenied(input: {
  hasIdentifier: boolean;
  fullName?: string | null;
}): string | null {
  if (!input.fullName?.trim()) return "fullName required";
  if (!input.hasIdentifier) {
    return "Patient must resolve to globalPersonId via FIN, passport, or MDM";
  }
  return null;
}

export function patientAnamnesisDenied(anamnesisText: string | null | undefined, updatingClinical: boolean): string | null {
  if (!updatingClinical) return null;
  if (anamnesisText != null && !String(anamnesisText).trim()) {
    return "Anamnesis text is required when updating clinical demographics";
  }
  return null;
}

/** Episode ICD-10 on the patient card is recorded against an OPEN sanatorium course. */
export function patientCardDiagnosisWriteDenied(hasOpenEpisode: boolean): string | null {
  if (!hasOpenEpisode) return "No open sanatorium episode";
  return null;
}
