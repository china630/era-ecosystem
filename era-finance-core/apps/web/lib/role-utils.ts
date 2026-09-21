import {
  CP_PERMISSION,
  sessionHasAnyCpPermission,
} from "@era/contracts";

export { CP_PERMISSION };

export type PermissionSubject = {
  permissions?: string[] | null;
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  /** Donor role — identity only (AUDITOR belt / DEPT_HEAD). Grants = permissions[]. */
  role?: string | null;
};

export function can(
  subject: PermissionSubject | null | undefined,
  ...keys: string[]
): boolean {
  if (!subject) return false;
  if (subject.isSuperAdmin || subject.isOwner) return true;
  const granted = subject.permissions ?? [];
  return sessionHasAnyCpPermission(granted, keys);
}

/** Restricted ops user — no ledger.post and no invoices.update (USER template). */
export function isRestrictedUserRole(
  subjectOrRole: PermissionSubject | string | undefined,
): boolean {
  if (typeof subjectOrRole === "string" || subjectOrRole === undefined) {
    return subjectOrRole === "USER";
  }
  if (subjectOrRole.isSuperAdmin || subjectOrRole.isOwner) return false;
  if (subjectOrRole.permissions != null) {
    return (
      !can(subjectOrRole, CP_PERMISSION.API_LEDGER_POST) &&
      !can(subjectOrRole, CP_PERMISSION.API_INVOICES_UPDATE)
    );
  }
  return subjectOrRole.role === "USER";
}

/** Period close — api:ledger.period_close. */
export function canCloseAccountingPeriod(
  subjectOrRole: PermissionSubject | string | undefined,
): boolean {
  if (typeof subjectOrRole === "string" || subjectOrRole === undefined) {
    return subjectOrRole === "OWNER" || subjectOrRole === "ADMIN";
  }
  return can(subjectOrRole, CP_PERMISSION.API_LEDGER_PERIOD_CLOSE);
}

/**
 * Finance billing proxy — OWNER via isOwner (locked manage key).
 * Do not grant via DIRECTOR JWT alone in Finance UI.
 */
export function canAccessBilling(
  subjectOrRole: PermissionSubject | string | null | undefined,
): boolean {
  if (typeof subjectOrRole === "string" || subjectOrRole == null) {
    return subjectOrRole === "OWNER";
  }
  return Boolean(subjectOrRole.isOwner || subjectOrRole.isSuperAdmin);
}

/** P&L department filter — reports.nas holders with post/read depth. */
export function canUsePlDepartmentFilter(
  subjectOrRole: PermissionSubject | string | undefined,
): boolean {
  if (typeof subjectOrRole === "string" || subjectOrRole === undefined) {
    return (
      subjectOrRole === "OWNER" ||
      subjectOrRole === "ADMIN" ||
      subjectOrRole === "ACCOUNTANT" ||
      subjectOrRole === "DIRECTOR"
    );
  }
  return (
    can(subjectOrRole, CP_PERMISSION.API_REPORTS_NAS) &&
    (can(subjectOrRole, CP_PERMISSION.API_LEDGER_POST) ||
      can(subjectOrRole, CP_PERMISSION.API_LEDGER_READ) ||
      Boolean(subjectOrRole.isOwner))
  );
}

export function isAuditorDonorRole(role: string | null | undefined): boolean {
  return role === "AUDITOR";
}

export function isDepartmentHeadRole(role: string | null | undefined): boolean {
  return role === "DEPARTMENT_HEAD";
}
