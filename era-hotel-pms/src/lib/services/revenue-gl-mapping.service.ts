import { prisma } from '@/lib/prisma';
import type { RevenueCodeRole } from '@/lib/revenue-code-match';

/**
 * One code per role in an org: assigning a role takes it off the code that had it.
 * `null` clears the role from this code.
 */
export async function setRevenueCodeRole(revenueCodeId: string, role: RevenueCodeRole | null) {
  return prisma.$transaction(async (tx) => {
    const code = await tx.revenueCode.findUnique({ where: { id: revenueCodeId } });
    if (!code) throw new Error('Revenue code not found');
    if (role) {
      await tx.revenueCode.updateMany({
        where: { systemRole: role, NOT: { id: revenueCodeId } },
        data: { systemRole: null },
      });
    }
    return tx.revenueCode.update({ where: { id: revenueCodeId }, data: { systemRole: role } });
  });
}

export async function listRevenueGlMappings() {
  const codes = await prisma.revenueCode.findMany({ orderBy: { code: 'asc' } });
  const mappings = await prisma.hotelRevenueGlMapping.findMany({
    include: { revenueCode: true },
  });
  const byCodeId = new Map(mappings.map((m) => [m.revenueCodeId, m]));
  return codes.map((code) => {
    const row = byCodeId.get(code.id);
    return {
      id: row?.id ?? code.id,
      glAccountCode: row?.glAccountCode ?? '',
      revenueCode: code,
    };
  });
}

/** Analytical subaccounts use a dot (601.1). A hyphen is a different code. */
export function assertDottedGlAccount(glAccountCode: string): string {
  const account = glAccountCode.trim();
  if (!account) throw new Error('GL account is required');
  if (account.includes('-')) {
    throw new Error('GL account uses a dot (601.1), not a hyphen');
  }
  return account;
}

export async function upsertRevenueGlMapping(revenueCodeId: string, glAccountCode: string) {
  const account = assertDottedGlAccount(glAccountCode);
  return prisma.hotelRevenueGlMapping.upsert({
    where: { revenueCodeId },
    create: { revenueCodeId, glAccountCode: account },
    update: { glAccountCode: account },
    include: { revenueCode: true },
  });
}

/** Saved HotelRevenueGlMapping only. No stand-in account. */
export async function resolveGlAccountCode(
  revenueCode: string,
): Promise<{ glAccountCode: string; unmapped: boolean }> {
  const code = revenueCode.trim();
  if (!code) return { glAccountCode: '', unmapped: true };
  const row = await prisma.hotelRevenueGlMapping.findFirst({
    where: { revenueCode: { code } },
  });
  if (!row?.glAccountCode.trim()) return { glAccountCode: '', unmapped: true };
  return { glAccountCode: row.glAccountCode.trim(), unmapped: false };
}

export async function enrichSaleLinesWithGl(
  lines: Array<{ sku: string; qty: number; amount: number; revenueCode: string }>,
): Promise<
  Array<{
    sku: string;
    qty: number;
    amount: number;
    revenueCode: string;
    glAccountCode: string;
    unmapped: boolean;
  }>
> {
  const enriched = [];
  for (const line of lines) {
    if (line.amount === 0) {
      enriched.push({ ...line, glAccountCode: '', unmapped: false });
      continue;
    }
    const resolved = await resolveGlAccountCode(line.revenueCode);
    enriched.push({
      ...line,
      glAccountCode: resolved.glAccountCode,
      unmapped: resolved.unmapped,
    });
  }
  return enriched;
}

export async function enrichRevenueLinesWithGl(
  lines: Array<{ revenueCode: string; amount: number }>,
): Promise<Array<{ revenueCode: string; amount: number; glAccountCode: string; unmapped: boolean }>> {
  const enriched = [];
  for (const line of lines) {
    const resolved = await resolveGlAccountCode(line.revenueCode);
    enriched.push({
      ...line,
      glAccountCode: resolved.glAccountCode,
      unmapped: resolved.unmapped,
    });
  }
  return enriched;
}
