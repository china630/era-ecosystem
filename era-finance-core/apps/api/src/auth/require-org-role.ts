import { ForbiddenException } from "@nestjs/common";
import type { UserRole } from "@erafinance/database";
import type { AuthUser } from "./types/auth-user";

/**
 * Org presence check — returns donor UserRole for legacy callers.
 * Authorization grants are JWT `permissions[]` via PermissionsGuard (Wave 5),
 * not this helper. Without organization in the token — auth/companies only.
 */
export function requireOrgRole(user: AuthUser): UserRole {
  if (user.role == null) {
    throw new ForbiddenException(
      "Нет контекста организации: создайте компанию или выберите её в «Мои компании».",
    );
  }
  return user.role;
}
