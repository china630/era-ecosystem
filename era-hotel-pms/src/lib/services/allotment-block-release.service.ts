import { prisma } from '@/lib/prisma';

/** Soft-release blocks past cutoff. HEADLESS via /api/cron/allotment-block-cutoff */
export async function releaseAllotmentBlocksPastCutoff(asOf: Date = new Date()) {
  const day = new Date(asOf.toISOString().slice(0, 10));
  const due = await prisma.allotmentBlock.findMany({
    where: {
      cutoffDate: { lte: day },
      status: { in: ['TENTATIVE', 'DEFINITE'] },
    },
    select: { id: true, code: true, status: true, cutoffDate: true },
  });
  if (due.length === 0) {
    return { released: 0, codes: [] as string[], asOf: day.toISOString().slice(0, 10) };
  }
  await prisma.allotmentBlock.updateMany({
    where: { id: { in: due.map((b) => b.id) } },
    data: { status: 'RELEASED' },
  });
  return {
    released: due.length,
    codes: due.map((b) => b.code),
    asOf: day.toISOString().slice(0, 10),
  };
}
