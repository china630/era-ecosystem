import { prisma } from '@/lib/prisma';
import type { RevenueCodeRole } from '@/lib/revenue-code-match';

export {
  REVENUE_CODE_ROLES,
  LODGING_ROLES,
  LODGING_PAYMENT_ROLES,
  STAY_NIGHT_ROLES,
  isRevenueCodeRole,
  revenueRoleIn,
  revenueRoleIs,
  normalizeRevenueRole,
  type RevenueCodeRole,
} from '@/lib/revenue-code-match';

export class RevenueRoleMissingError extends Error {
  readonly code = 'REVENUE_ROLE_MISSING';
  constructor(readonly role: RevenueCodeRole) {
    super(
      `No active revenue code has the system role ${role}. Assign it in Settings → Integration → GL.`,
    );
    this.name = 'RevenueRoleMissingError';
  }
}

/** Active revenue code that carries this system role, or null. MEDICAL falls back to PROCEDURE. */
export async function findRevenueCodeByRole(role: RevenueCodeRole) {
  const primary = await prisma.revenueCode.findFirst({ where: { systemRole: role, active: true } });
  if (primary) return primary;
  if (role === 'MEDICAL' || role === 'PROCEDURE') {
    const alt = role === 'MEDICAL' ? 'PROCEDURE' : 'MEDICAL';
    return prisma.revenueCode.findFirst({ where: { systemRole: alt, active: true } });
  }
  return null;
}

/** Active revenue code for this role; throws when the role is unassigned. */
export async function requireRevenueCodeByRole(role: RevenueCodeRole) {
  const row = await findRevenueCodeByRole(role);
  if (!row) throw new RevenueRoleMissingError(role);
  return row;
}

/** Active revenue code by its exact code (what satellites send). */
export async function findRevenueCodeByCode(code: string) {
  const key = code.trim();
  if (!key) return null;
  return prisma.revenueCode.findFirst({ where: { code: key, active: true } });
}
