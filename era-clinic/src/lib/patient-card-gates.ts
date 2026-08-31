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

/**
 * @deprecated CLI-55 — anamnesis lives on ClinicalEpisode; demographics PATCH no longer requires it.
 * Kept for transitional tests; always returns null when updatingClinical is false.
 * Prefer episodeAnamnesisDenied from @/domain/sanatorium/episode-gates.
 */
export function patientAnamnesisDenied(
  _anamnesisText: string | null | undefined,
  updatingClinical: boolean,
): string | null {
  if (!updatingClinical) return null;
  // Demographics no longer gated by anamnesis (CLI-55).
  return null;
}

/** Episode ICD-10 on the patient card is recorded against an OPEN sanatorium course. */
export function patientCardDiagnosisWriteDenied(hasOpenEpisode: boolean): string | null {
  if (!hasOpenEpisode) return "No open sanatorium episode";
  return null;
}
