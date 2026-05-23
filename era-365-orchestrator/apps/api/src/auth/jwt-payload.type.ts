import type { UserRole } from "@era365/database";

export type EraJwtPayload = {
  sub: string;
  email: string;
  organizationId: string | null;
  role: UserRole | null;
  permissions?: string[];
  isSuperAdmin?: boolean;
};
