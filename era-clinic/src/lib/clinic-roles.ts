export const CLINIC_ROLE = {
  CLINIC_ADMIN: "CLINIC_ADMIN",
  RECEPTION: "RECEPTION",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
} as const;

export type ClinicRoleCode = (typeof CLINIC_ROLE)[keyof typeof CLINIC_ROLE];

export function sessionHasClinicRole(
  role: string | undefined,
  allowed: ClinicRoleCode[],
): boolean {
  if (!role) return false;
  return allowed.includes(role as ClinicRoleCode);
}
