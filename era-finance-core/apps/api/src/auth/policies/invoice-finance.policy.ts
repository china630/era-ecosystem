import { ForbiddenException } from "@nestjs/common";
import { InvoiceStatus, type UserRole } from "@erafinance/database";
import {
  CP_PERMISSION,
  sessionHasAnyCpPermission,
} from "@era/contracts";

export type PolicySubject = {
  permissions?: string[] | null;
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  role?: UserRole | string | null;
};

function asSubject(roleOrSubject: UserRole | PolicySubject): PolicySubject {
  if (typeof roleOrSubject === "string") return { role: roleOrSubject };
  return roleOrSubject;
}

function effectiveGranted(subject: PolicySubject): string[] {
  return Array.isArray(subject.permissions) ? subject.permissions : [];
}

/**
 * Mutate PAID invoices requires api:invoices.update (USER template has create only).
 */
export function assertUserMayMutateInvoiceInPaidStatus(
  roleOrSubject: UserRole | PolicySubject,
  invoiceStatus: InvoiceStatus,
): void {
  if (invoiceStatus !== InvoiceStatus.PAID) return;
  const subject = asSubject(roleOrSubject);
  if (subject.isSuperAdmin || subject.isOwner) return;
  if (
    !sessionHasAnyCpPermission(effectiveGranted(subject), [
      CP_PERMISSION.API_INVOICES_UPDATE,
    ])
  ) {
    throw new ForbiddenException(
      "Missing permission api:invoices.update for PAID invoice mutation",
    );
  }
}

/** Manual journal / cash / bank post — requires api:ledger.post. */
export function assertMayPostManualJournal(
  roleOrSubject: UserRole | PolicySubject,
): void {
  const subject = asSubject(roleOrSubject);
  if (subject.isSuperAdmin || subject.isOwner) return;
  if (
    !sessionHasAnyCpPermission(effectiveGranted(subject), [
      CP_PERMISSION.API_LEDGER_POST,
    ])
  ) {
    throw new ForbiddenException("Missing permission api:ledger.post");
  }
}
