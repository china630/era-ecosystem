import { ROLE_CODES, type RoleCode } from '@/lib/auth/permissions';

/** Hotel roles that may open Əsas / executive KPI dashboard (local PMS session). */
const HOTEL_EXECUTIVE_ROLES = new Set<RoleCode>([
  ROLE_CODES.HOTEL_ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.FINANCIAL_AUDITOR,
  ROLE_CODES.RECEPTIONIST,
  ROLE_CODES.NIGHT_AUDITOR,
  ROLE_CODES.CRM,
]);

export function canViewHotelExecutive(role: string | undefined | null): boolean {
  if (!role) return false;
  return HOTEL_EXECUTIVE_ROLES.has(role as RoleCode);
}
