import type { UserRole } from "@era365/database";

export type EraJwtPayload = {
  sub: string;
  email: string;
  organizationId: string | null;
  /** Primary membership role (backward compatible). */
  role: UserRole | null;
  /** All active roles for the org context (v1: single role). */
  roles: UserRole[];
  isOwner: boolean;
  permissions?: string[];
  isSuperAdmin?: boolean;
};
