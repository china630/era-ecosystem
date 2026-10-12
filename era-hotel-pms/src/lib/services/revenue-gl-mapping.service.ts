import { prisma } from '@/lib/prisma';

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

export async function upsertRevenueGlMapping(revenueCodeId: string, glAccountCode: string) {
  const account = glAccountCode.trim();
  if (!account) throw new Error('GL account is required');
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
  const token = revenueCode.trim();
  if (!token) return { glAccountCode: '', unmapped: true };
  const row = await prisma.hotelRevenueGlMapping.findFirst({
    where: {
      OR: [
        { revenueCode: { code: token } },
        { revenueCode: { name: { equals: token, mode: 'insensitive' } } },
      ],
    },
  });
  if (!row?.glAccountCode.trim()) return { glAccountCode: '', unmapped: true };
  return { glAccountCode: row.glAccountCode.trim(), unmapped: false };
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
