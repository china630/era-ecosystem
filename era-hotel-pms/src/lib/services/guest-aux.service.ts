import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';

export async function listGuestNotes(guestId: string) {
  return prisma.guestNote.findMany({
    where: { guestId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createGuestNote(guestId: string, text: string, noteType = 'GENERAL') {
  return prisma.guestNote.create({
    data: { guestId, text, noteType },
  });
}

export async function listGuestTasks(guestId: string) {
  return prisma.guestTask.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGuestTask(guestId: string, title: string, dueAt?: Date) {
  return prisma.guestTask.create({
    data: { guestId, title, dueAt: dueAt ?? null },
  });
}

export async function listGuestLoyaltyCards(guestId: string) {
  const rows = await prisma.guestLoyaltyCard.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    ...r,
    points: r.points != null ? decimalToNumber(r.points) : null,
  }));
}

export async function createGuestLoyaltyCard(
  guestId: string,
  input: { cardNumber: string; tier?: string; points?: number },
) {
  const row = await prisma.guestLoyaltyCard.create({
    data: {
      guestId,
      cardNumber: input.cardNumber,
      tier: input.tier ?? null,
      points: input.points != null ? toDecimal(input.points) : null,
    },
  });
  return { ...row, points: row.points != null ? decimalToNumber(row.points) : null };
}

export async function listGuestTimeShares(guestId: string) {
  return prisma.guestTimeShareAgreement.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGuestTimeShare(
  guestId: string,
  input: { contractNo: string; unitCode?: string; weekNo?: number; status?: string },
) {
  return prisma.guestTimeShareAgreement.create({
    data: {
      guestId,
      contractNo: input.contractNo,
      unitCode: input.unitCode ?? null,
      weekNo: input.weekNo ?? null,
      status: input.status ?? 'ACTIVE',
    },
  });
}
