import type { UserRole } from "@erafinance/database";
import { requireOrgRole } from "../require-org-role";
import type { AuthUser } from "../types/auth-user";
import type { PolicySubject } from "./invoice-finance.policy";

/** Build policy subject from request AuthUser (JWT permissions SoT). */
export function toPolicySubject(
  user: Pick<
    AuthUser,
    "permissions" | "isOwner" | "isSuperAdmin" | "role"
  > | null | undefined,
  fallbackRole?: UserRole | string | null,
): PolicySubject {
  if (!user) {
    return { role: fallbackRole ?? null, permissions: undefined };
  }
  return {
    permissions: user.permissions,
    isOwner: user.isOwner,
    isSuperAdmin: user.isSuperAdmin,
    role: user.role ?? fallbackRole ?? null,
  };
}

/** Org must be present; returns subject with JWT permissions for policy checks. */
export function requireOrgPolicySubject(user: AuthUser): PolicySubject {
  requireOrgRole(user);
  return toPolicySubject(user);
}

/** When only a role string is available (legacy service signatures). */
export function policySubjectFromRole(
  role: UserRole | string | null | undefined,
  extra?: Partial<PolicySubject>,
): PolicySubject {
  return {
    role: role ?? null,
    permissions: extra?.permissions,
    isOwner: extra?.isOwner,
    isSuperAdmin: extra?.isSuperAdmin,
  };
}
