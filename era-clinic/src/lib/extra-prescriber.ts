/** Who is stored on a paid extra as the prescribing doctor. */

export function resolveExtraPrescriber(input: {
  actorPractitionerId: string | null;
  actorIsDoctor: boolean;
  /** Episode care doctors, earliest assignedAt first. */
  careDoctorIdsInAssignedOrder: string[];
}): string | null {
  if (input.actorIsDoctor && input.actorPractitionerId) return input.actorPractitionerId;
  return input.careDoctorIdsInAssignedOrder[0] ?? null;
}
