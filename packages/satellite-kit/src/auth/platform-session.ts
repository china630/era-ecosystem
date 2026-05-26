import {
  FINANCE_CROSS_SYSTEM_ROLES,
  FINANCE_OWNER_ROLES,
  SATELLITE_ROLE,
  type SatelliteRoleCode,
} from "./roles";
import type { SatelliteSessionPayload } from "./session";

export { FINANCE_CROSS_SYSTEM_ROLES };

export type PlatformCapabilities = {
  financeRole?: string;
  satelliteRole: SatelliteRoleCode;
  isOwner: boolean;
  isPlatformSession: boolean;
  canManageBilling: boolean;
  canViewExecutive: boolean;
  canManageTeam: boolean;
};

export function resolvePlatformCapabilities(
  session: Pick<
    SatelliteSessionPayload,
    "role" | "financeRole" | "isOwner" | "organizationId"
  >,
): PlatformCapabilities {
  const financeRole = session.financeRole?.trim().toUpperCase();
  const isPlatformSession = Boolean(financeRole && session.organizationId);

  const isOwner =
    session.isOwner === true ||
    session.role === SATELLITE_ROLE.BUSINESS_OWNER ||
    (financeRole
      ? FINANCE_OWNER_ROLES.includes(
          financeRole as (typeof FINANCE_OWNER_ROLES)[number],
        )
      : false);

  const isFinanceMember =
    financeRole &&
    FINANCE_CROSS_SYSTEM_ROLES.includes(
      financeRole as (typeof FINANCE_CROSS_SYSTEM_ROLES)[number],
    );

  return {
    financeRole: session.financeRole,
    satelliteRole: session.role as SatelliteRoleCode,
    isOwner,
    isPlatformSession,
    canManageBilling: isOwner,
    canViewExecutive: Boolean(isOwner || isFinanceMember),
    canManageTeam: isOwner,
  };
}

/** Local waiter/cook login — no orchestrator financeRole. */
export function isLocalOperationalSession(
  session: Pick<SatelliteSessionPayload, "financeRole" | "organizationId">,
): boolean {
  return !session.financeRole?.trim();
}

export function hasPlatformCapability(
  session: Pick<
    SatelliteSessionPayload,
    "role" | "financeRole" | "isOwner" | "organizationId"
  >,
  cap: keyof Pick<
    PlatformCapabilities,
    "canManageBilling" | "canViewExecutive" | "canManageTeam"
  >,
): boolean {
  return resolvePlatformCapabilities(session)[cap];
}
