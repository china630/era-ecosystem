import type { UserRole } from "@erafinance/database";

/** JWT claims issued by era-365-orchestrator (HS256 phase A; RS256 + JWKS later). */
export type ControlPlaneJwtPayload = {
  sub: string;
  email: string;
  organizationId: string | null;
  role: UserRole | null;
  roles?: UserRole[];
  isOwner?: boolean;
  permissions?: string[];
  isSuperAdmin?: boolean;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
};
