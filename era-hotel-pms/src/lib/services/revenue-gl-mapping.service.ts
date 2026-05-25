import { prisma } from '@/lib/prisma';

const DEFAULT_GL_BY_CODE: Record<string, string> = {
  ROOM: '601',
  FOOD: '602',
  MEDICAL: '603',
  PKG: '601',
  TREATMENT: '604',
  BOARD: '605',
  TRANSFER: '606',
};

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
      glAccountCode: row?.glAccountCode ?? DEFAULT_GL_BY_CODE[code.code] ?? '601',
      revenueCode: code,
    };
  });
}

export async function upsertRevenueGlMapping(revenueCodeId: string, glAccountCode: string) {
  return prisma.hotelRevenueGlMapping.upsert({
    where: { revenueCodeId },
    create: { revenueCodeId, glAccountCode },
    update: { glAccountCode },
    include: { revenueCode: true },
  });
}

export async function resolveGlAccountCode(revenueCode: string): Promise<string> {
  const row = await prisma.hotelRevenueGlMapping.findFirst({
    where: { revenueCode: { code: revenueCode } },
  });
  if (row) return row.glAccountCode;
  return DEFAULT_GL_BY_CODE[revenueCode] ?? process.env.DEFAULT_HOTEL_GL_REVENUE ?? '601';
}

export async function enrichRevenueLinesWithGl(
  lines: Array<{ revenueCode: string; amount: number }>,
): Promise<Array<{ revenueCode: string; amount: number; glAccountCode: string }>> {
  const enriched = [];
  for (const line of lines) {
    enriched.push({
      ...line,
      glAccountCode: await resolveGlAccountCode(line.revenueCode),
    });
  }
  return enriched;
}

export async function seedDefaultRevenueGlMappings() {
  const codes = await prisma.revenueCode.findMany();
  for (const code of codes) {
    const glAccountCode = DEFAULT_GL_BY_CODE[code.code] ?? '601';
    await prisma.hotelRevenueGlMapping.upsert({
      where: { revenueCodeId: code.id },
      create: { revenueCodeId: code.id, glAccountCode },
      update: {},
    });
  }
}
