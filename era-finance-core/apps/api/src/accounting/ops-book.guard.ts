import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  AccountingBookGaapKind,
  UserRole,
} from "@erafinance/database";
import {
  CP_PERMISSION,
  sessionHasAnyCpPermission,
} from "@era/contracts";
import type { PolicySubject } from "../auth/policies/invoice-finance.policy";

/** Donor roles that may select MANAGEMENT books when permissions are absent (legacy). */
export const MGMT_BOOK_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
]);

/** Donor roles that may edit Employee.internalRate (grey FOT) — legacy fallback. */
export const INTERNAL_RATE_EDIT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
]);

export type OpsBookShape = {
  gaapKind: AccountingBookGaapKind | string;
  code?: string;
  isDefaultOps?: boolean;
};

export type OpsAccessSubject = UserRole | string | PolicySubject | null | undefined;

function asPolicy(subject: OpsAccessSubject): PolicySubject | null {
  if (subject == null) return null;
  if (typeof subject === "string") return { role: subject };
  return subject;
}

/**
 * Wave 5: statutory ops forever = NAS. MANAGEMENT / EXTRA never become default ops
 * and must not receive cash / payroll / tax / stock money paths.
 */
export function assertOpsBookIsNas(book: OpsBookShape): void {
  const kind = String(book.gaapKind).toUpperCase();
  if (kind !== AccountingBookGaapKind.NAS && kind !== "NAS") {
    throw new BadRequestException({
      code: "OPS_BOOK_MUST_BE_NAS",
      message:
        "Default operations and money paths (cash, payroll, tax, stock) require a NAS book",
    });
  }
}

/**
 * Reject an explicit client book id when it resolves to MANAGEMENT on a money path.
 * No-op when bookId is omitted (caller uses default ops NAS).
 */
export function assertMoneyPathBookNotManagement(
  book: OpsBookShape | null | undefined,
): void {
  if (!book) return;
  const kind = String(book.gaapKind).toUpperCase();
  if (kind === AccountingBookGaapKind.MANAGEMENT || kind === "MANAGEMENT") {
    throw new BadRequestException({
      code: "OPS_BOOK_MUST_BE_NAS",
      message:
        "Cash, payroll, tax export, and stock postings cannot use a MANAGEMENT book",
    });
  }
}

/** MANAGEMENT books / compare — api:book.mgmt (legacy donor OWNER|ADMIN|DIRECTOR). */
export function canAccessMgmtBooks(subject: OpsAccessSubject): boolean {
  const s = asPolicy(subject);
  if (!s) return false;
  if (s.isSuperAdmin || s.isOwner) return true;
  if (!Array.isArray(s.permissions)) return false;
  return sessionHasAnyCpPermission(s.permissions, [
    CP_PERMISSION.API_BOOK_MGMT,
  ]);
}

export function assertCanAccessMgmtBook(
  subject: OpsAccessSubject,
  book: OpsBookShape,
): void {
  const kind = String(book.gaapKind).toUpperCase();
  if (kind !== AccountingBookGaapKind.MANAGEMENT && kind !== "MANAGEMENT") {
    return;
  }
  if (!canAccessMgmtBooks(subject)) {
    throw new ForbiddenException({
      code: "MGMT_BOOK_FORBIDDEN",
      message: "MANAGEMENT book reports require permission api:book.mgmt",
    });
  }
}

/** Forbid posting MANUAL_ADJUSTMENT into MANAGEMENT without api:book.mgmt. */
export function assertCanPostToMgmtBook(
  subject: OpsAccessSubject,
  book: OpsBookShape,
): void {
  assertCanAccessMgmtBook(subject, book);
}

export function filterBooksForRole<T extends OpsBookShape>(
  books: T[],
  subject: OpsAccessSubject,
): T[] {
  if (canAccessMgmtBooks(subject)) return books;
  return books.filter((b) => {
    const kind = String(b.gaapKind).toUpperCase();
    return kind !== AccountingBookGaapKind.MANAGEMENT && kind !== "MANAGEMENT";
  });
}

/**
 * Org setting `settings.hr.internalRateVisibleToHrManager` (default false).
 * book.mgmt holders always; HR_MANAGER only when policy on; ACCOUNTANT never via donor.
 */
export function canSeeInternalRate(
  subject: OpsAccessSubject,
  orgSettings?: unknown,
): boolean {
  const s = asPolicy(subject);
  if (!s) return false;
  if (canAccessMgmtBooks(s)) return true;
  const role = s.role;
  if (role !== UserRole.HR_MANAGER) return false;
  const settings =
    orgSettings && typeof orgSettings === "object" && !Array.isArray(orgSettings)
      ? (orgSettings as Record<string, unknown>)
      : {};
  const hr =
    settings.hr && typeof settings.hr === "object" && !Array.isArray(settings.hr)
      ? (settings.hr as Record<string, unknown>)
      : {};
  return hr.internalRateVisibleToHrManager === true;
}

export function canEditInternalRate(subject: OpsAccessSubject): boolean {
  return canAccessMgmtBooks(subject);
}

export function assertCanEditInternalRate(subject: OpsAccessSubject): void {
  if (!canEditInternalRate(subject)) {
    throw new ForbiddenException({
      code: "INTERNAL_RATE_FORBIDDEN",
      message:
        "Employee.internalRate requires permission api:book.mgmt (OWNER/ADMIN/DIRECTOR package)",
    });
  }
}

export function stripInternalRateIfForbidden<T extends Record<string, unknown>>(
  row: T,
  subject: OpsAccessSubject,
  orgSettings?: unknown,
): T {
  if (canSeeInternalRate(subject, orgSettings)) return row;
  if (!("internalRate" in row)) return row;
  const { internalRate: _drop, ...rest } = row;
  return rest as T;
}
