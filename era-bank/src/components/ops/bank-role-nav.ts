/**
 * Ops sidebar visibility by screen grants (Variant A).
 * Entitlement modules still apply on top via useBankEntitlements.
 * @deprecated ROLE_NAV_ALLOW — role name no longer grants nav; use screen:* grants.
 */
import { screenPermissionForNavHref } from "@/lib/auth/page-route-permissions";
import {
  sessionHasBankPermission,
  type BankPermissionSession,
} from "@/lib/auth/permission-check";
import type { Permission } from "@/lib/auth/permissions";

export type BankOpsRoleCode =
  | "TELLER"
  | "BRANCH_MANAGER"
  | "AML_OFFICER"
  | "CARDS_OFFICER"
  | "TREASURY_OFFICER"
  | "BUSINESS_OWNER"
  | "PLATFORM_MEMBER"
  | "SATELLITE_OPERATOR";

export function isNavAllowedForSession(
  href: string,
  session: BankPermissionSession | null | undefined,
): boolean {
  if (!session) return false;
  const required = screenPermissionForNavHref(href);
  if (!required) return false;
  return sessionHasBankPermission(session, required);
}

/** @deprecated Prefer isNavAllowedForSession with permissions[]. */
export function isNavAllowedForRole(
  href: string,
  role: string | null | undefined,
  permissions?: Permission[] | string[],
  isOwner?: boolean,
): boolean {
  if (!role && !permissions?.length) return false;
  return isNavAllowedForSession(href, {
    login: "",
    role: role ?? "",
    permissions: permissions?.map(String),
    isOwner,
  });
}
