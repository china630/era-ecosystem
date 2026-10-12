import { prisma } from '@/lib/prisma';
import { matchKnownElektraRevenue } from '@/lib/integration/elektraweb-revenue';

export { matchesAnyRevenueToken, revenueTokenMatches } from '@/lib/revenue-code-match';

/**
 * Active revenue row for a token. Code, then name, then an Elektra alias
 * (Прачечная → LAUNDRY) when the live key is numeric.
 */
export async function findRevenueCodeByToken(token: string) {
  const key = token.trim();
  if (!key) return null;
  const byCode = await prisma.revenueCode.findFirst({
    where: { code: { equals: key, mode: 'insensitive' }, active: true },
  });
  if (byCode) return byCode;
  const byName = await prisma.revenueCode.findFirst({
    where: { name: { equals: key, mode: 'insensitive' }, active: true },
  });
  if (byName) return byName;
  const upper = key.toUpperCase();
  const rows = await prisma.revenueCode.findMany({ where: { active: true } });
  return (
    rows.find(
      (row) => matchKnownElektraRevenue({ code: row.code, name: row.name })?.code === upper,
    ) ?? null
  );
}
