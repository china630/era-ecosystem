import type { UserRole } from "@erafinance/database";

export type AuthUser = {
  userId: string;
  email: string;
  /** null — пользователь вошёл, но ещё не выбрал/не создал организацию (ТЗ: сначала пользователь, потом компания). */
  organizationId: string | null;
  role: UserRole | null;
  roles?: UserRole[];
  permissions?: string[];
  isOwner?: boolean;
  /** Загружается из БД при валидации JWT. */
  isSuperAdmin?: boolean;
};
