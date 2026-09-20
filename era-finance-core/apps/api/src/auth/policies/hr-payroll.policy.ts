import { ForbiddenException } from "@nestjs/common";
import type { UserRole } from "@erafinance/database";
import {
  CP_PERMISSION,
  sessionHasAnyCpPermission,
} from "@era/contracts";
import type { PolicySubject } from "./invoice-finance.policy";

function asSubject(roleOrSubject: UserRole | PolicySubject): PolicySubject {
  if (typeof roleOrSubject === "string") return { role: roleOrSubject };
  return roleOrSubject;
}

function effectiveGranted(subject: PolicySubject): string[] {
  return Array.isArray(subject.permissions) ? subject.permissions : [];
}

/** Payroll money (runs, payout) — api:payroll.money (not hr_card alone). */
export function assertMayAccessPayrollFinance(
  roleOrSubject: UserRole | PolicySubject,
): void {
  const subject = asSubject(roleOrSubject);
  if (subject.isSuperAdmin || subject.isOwner) return;
  if (
    !sessionHasAnyCpPermission(effectiveGranted(subject), [
      CP_PERMISSION.API_PAYROLL_MONEY,
    ])
  ) {
    throw new ForbiddenException("Missing permission api:payroll.money");
  }
}

export function isDepartmentHeadRole(role: UserRole | string): boolean {
  return role === "DEPARTMENT_HEAD";
}
