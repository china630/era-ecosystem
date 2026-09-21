"use client";

import { useMemo } from "react";
import { useAuth } from "./auth-context";
import { can, CP_PERMISSION, type PermissionSubject } from "./role-utils";

/**
 * Effective UI grants from session access.permissions (+ owner/SA bypass).
 * Matrix lives in Orchestrator `/settings/access` — not in Finance.
 */
export function useOrgPermissions() {
  const { user, access } = useAuth();
  return useMemo(() => {
    const subject: PermissionSubject = {
      permissions: access.permissions,
      isOwner: Boolean(user?.isOwner),
      isSuperAdmin: Boolean(user?.isSuperAdmin),
      role: user?.role ?? null,
    };
    return {
      orgRole: user?.role ?? null,
      subject,
      can: (...keys: string[]) => can(subject, ...keys),
      canPostAccounting:
        Boolean(user?.isSuperAdmin) ||
        access.canPostAccounting ||
        can(subject, CP_PERMISSION.API_LEDGER_POST),
      canViewHoldingReports:
        Boolean(user?.isSuperAdmin) || access.canViewHoldingReports,
      canAccessPayrollMoney: can(subject, CP_PERMISSION.API_PAYROLL_MONEY),
      canAccessBilling: Boolean(user?.isOwner || user?.isSuperAdmin),
      isSuperAdmin: Boolean(user?.isSuperAdmin),
      isOwner: Boolean(user?.isOwner),
      permissions: access.permissions ?? [],
    };
  }, [user?.isSuperAdmin, user?.isOwner, user?.role, access]);
}
