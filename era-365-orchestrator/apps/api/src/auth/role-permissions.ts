import type { UserRole } from "@era365/database";

/** Finance-aligned permission codes embedded in CP JWT (Wave E-C). */
export const ALL_PERMISSION_CODES = [
  "billing.manage",
  "accounting.post",
  "invoices.create",
  "invoices.update",
  "purchases.manage",
  "hr.manage",
  "inventory.manage",
  "psa.manage",
  "reporting.view",
  "admin.system",
] as const;

const OWNER: string[] = [...ALL_PERMISSION_CODES];

const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  OWNER,
  ADMIN: [
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "purchases.manage",
    "hr.manage",
    "inventory.manage",
    "psa.manage",
    "reporting.view",
  ],
  ACCOUNTANT: [
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "reporting.view",
  ],
  USER: ["invoices.create", "reporting.view"],
  PROCUREMENT: ["purchases.manage", "reporting.view"],
  AUDITOR: ["reporting.view"],
  WAREHOUSE_KEEPER: ["inventory.manage", "reporting.view"],
  HR_OFFICER: ["hr.manage", "reporting.view"],
  HR_MANAGER: ["hr.manage", "reporting.view"],
  DEPARTMENT_HEAD: ["reporting.view", "invoices.create"],
  DIRECTOR: ["reporting.view", "billing.manage", "accounting.post"],
  PARTNER: ["reporting.view"],
};

export function resolvePermissionsForRole(
  role: UserRole | null,
  opts?: { isSuperAdmin?: boolean },
): string[] {
  if (opts?.isSuperAdmin) return [...ALL_PERMISSION_CODES];
  if (!role) return [];
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
