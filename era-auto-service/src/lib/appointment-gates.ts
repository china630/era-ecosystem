/** Pure appointment create gates (AC-AUTO-APPT negative paths). */

export function appointmentCreateDenied(input: {
  vehiclePlate?: string | null;
}): string | null {
  if (!input.vehiclePlate?.trim()) return "vehiclePlate required";
  return null;
}
