import type { ClinicAdminSession } from "@/lib/auth/clinic-admin-access";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

/**
 * Edge-safe — no Prisma. Visit-exam print is clinical PHI:
 * require visits API or patients API (doctors/reception have both; nurses/floor have patients).
 */
export function sessionMayPrintVisitExam(
  session: ClinicAdminSession & { permissions?: string[] },
): boolean {
  return (
    sessionHasClinicPermission(session, CLINIC_PERMISSION.API_VISITS) ||
    sessionHasClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS)
  );
}
