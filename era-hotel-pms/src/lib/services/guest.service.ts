import { prisma } from '@/lib/prisma';

export async function listGuests() {
  return prisma.guest.findMany({ orderBy: { fullName: 'asc' } });
}

export async function createGuest(input: {
  fullName: string;
  voen?: string | null;
  passportNumber: string;
  phone: string;
  globalPersonId?: string | null;
}) {
  return prisma.guest.create({
    data: {
      fullName: input.fullName,
      voen: input.voen ?? null,
      passportNumber: input.passportNumber,
      phone: input.phone,
      globalPersonId: input.globalPersonId ?? null,
    },
  });
}
