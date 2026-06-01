import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';

export async function listGuestLoyaltyPoints(guestId: string) {
  const rows = await prisma.guestLoyaltyPointEntry.findMany({
    where: { guestId },
    orderBy: { entryDate: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    entryDate: r.entryDate,
    points: decimalToNumber(r.points),
    description: r.description,
    balanceAfter: r.balanceAfter ? decimalToNumber(r.balanceAfter) : null,
  }));
}

export async function createGuestLoyaltyPoint(
  guestId: string,
  input: {
    entryDate: string;
    points: number;
    description?: string | null;
    balanceAfter?: number | null;
  },
) {
  return prisma.guestLoyaltyPointEntry.create({
    data: {
      guestId,
      entryDate: new Date(input.entryDate),
      points: toDecimal(input.points),
      description: input.description ?? null,
      balanceAfter:
        input.balanceAfter != null ? toDecimal(input.balanceAfter) : null,
    },
  });
}

export async function deleteGuestLoyaltyPoint(id: string) {
  return prisma.guestLoyaltyPointEntry.delete({ where: { id } });
}
